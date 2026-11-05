import { TipoEvento } from '@prisma/client';
import { addDays, format, isToday, isTomorrow, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { prisma } from '~/secure/db.server';
import { urlArquivo } from '~/storage/storage.server';
import { parseMonetaryNumber } from '~/shared/Number.util';
import pegarAnunciosDoDia from '~/domain/Anuncio/pegar-anuncios-do-dia.server';

export type EventoResumo = {
  id: number;
  titulo: string;
  descricao: string | null;
  tipo: string;
  data_hora: string;
};

export type MinhaFeira = {
  bancaId: number;
  evento: EventoResumo;
  hoje: boolean;
  caixaAberto: boolean;
  vendas: { quantidade: number; total: number };
  anuncios: number;
  curtidas: number;
};

export type Notificacao = {
  id: string;
  icone: string;
  texto: string;
  link?: string;
  nivel: 'info' | 'destaque' | 'alerta';
};

function resumirEvento(evento: {
  id: number;
  titulo: string;
  descricao: string | null;
  tipo: TipoEvento;
  data_hora: Date;
}): EventoResumo {
  return {
    id: evento.id,
    titulo: evento.titulo,
    descricao: evento.descricao,
    tipo: evento.tipo,
    data_hora: evento.data_hora.toISOString(),
  };
}

function linkEvento(evento: { id: number; tipo: string }) {
  return evento.tipo === TipoEvento.FEIRA ? `/calendario/feira/${evento.id}` : `/calendario/${evento.id}`;
}

/**
 * Dados do início para usuários comuns: o que acontece hoje, próximos
 * eventos, feiras em que participa como feirante, anúncios das bancas
 * e notificações derivadas desses dados.
 */
export default async function pegarDashboardUsuario(perfil: {
  id: number;
  nome: string;
  nome_banca?: string | null;
  logo_banca?: string | null;
  celular?: string | null;
}) {
  const agora = new Date();
  const inicioHoje = startOfDay(agora);

  const [eventosHoje, proximosEventos, bancas] = await Promise.all([
    prisma.eventos.findMany({
      where: { data_hora: { gte: inicioHoje, lte: endOfDay(agora) } },
      orderBy: { data_hora: 'asc' },
    }),
    prisma.eventos.findMany({
      where: { data_hora: { gt: endOfDay(agora) } },
      orderBy: { data_hora: 'asc' },
      take: 6,
    }),
    // Feiras do usuário: futuras/de hoje, ou passadas com o caixa ainda aberto
    prisma.evento_Feirante.findMany({
      where: {
        perfilId: perfil.id,
        evento: { tipo: TipoEvento.FEIRA },
        OR: [{ evento: { data_hora: { gte: inicioHoje } } }, { caixa_aberto: true }],
      },
      include: {
        evento: true,
        Operacao: { select: { valor: true } },
        _count: { select: { Anuncios: true } },
      },
      orderBy: { evento: { data_hora: 'asc' } },
      take: 10,
    }),
  ]);

  const curtidasPorBanca = bancas.length
    ? await prisma.anuncio_Feira.findMany({
        where: { eventoFeiranteId: { in: bancas.map((b) => b.id) } },
        select: { eventoFeiranteId: true, _count: { select: { curtidas: true } } },
      })
    : [];

  const minhasFeiras: MinhaFeira[] = bancas.map((banca) => ({
    bancaId: banca.id,
    evento: resumirEvento(banca.evento),
    hoje: isToday(banca.evento.data_hora),
    caixaAberto: banca.caixa_aberto,
    vendas: {
      quantidade: banca.Operacao.length,
      total: banca.Operacao.reduce((soma, op) => soma + parseMonetaryNumber(op.valor), 0),
    },
    anuncios: banca._count.Anuncios,
    curtidas: curtidasPorBanca
      .filter((a) => a.eventoFeiranteId === banca.id)
      .reduce((soma, a) => soma + a._count.curtidas, 0),
  }));

  const temFeiraHoje = eventosHoje.some((e) => e.tipo === TipoEvento.FEIRA);
  const anuncios = temFeiraHoje ? await pegarAnunciosDoDia(undefined, 8) : [];

  // ---------- Notificações ----------
  const notificacoes: Notificacao[] = [];

  for (const feira of minhasFeiras) {
    if (feira.hoje) {
      notificacoes.push({
        id: `feira-hoje-${feira.evento.id}`,
        icone: 'las la-store',
        nivel: 'destaque',
        texto: `Hoje você é feirante na ${feira.evento.titulo}, às ${format(new Date(feira.evento.data_hora), 'HH:mm')}.`,
        link: `/calendario/feira/${feira.evento.id}`,
      });

      if (feira.anuncios === 0)
        notificacoes.push({
          id: `anunciar-${feira.evento.id}`,
          icone: 'las la-bullhorn',
          nivel: 'info',
          texto: 'Você ainda não anunciou sua banca hoje. Uma mensagem ajuda a chamar clientes!',
          link: `/calendario/feira/${feira.evento.id}`,
        });

      if (feira.curtidas > 0)
        notificacoes.push({
          id: `curtidas-${feira.bancaId}`,
          icone: 'las la-heart',
          nivel: 'info',
          texto: `Seus anúncios receberam ${feira.curtidas} ${feira.curtidas === 1 ? 'curtida' : 'curtidas'}.`,
          link: `/calendario/feira/${feira.evento.id}/banca/${feira.bancaId}`,
        });
    } else if (new Date(feira.evento.data_hora) < inicioHoje && feira.caixaAberto) {
      notificacoes.push({
        id: `caixa-aberto-${feira.bancaId}`,
        icone: 'las la-cash-register',
        nivel: 'alerta',
        texto: `Seu caixa da ${feira.evento.titulo} ainda está aberto. Confira o extrato e acerte as contas.`,
        link: `/calendario/feira/${feira.evento.id}?consulting`,
      });
    } else if (isTomorrow(new Date(feira.evento.data_hora))) {
      notificacoes.push({
        id: `feira-amanha-${feira.evento.id}`,
        icone: 'las la-store',
        nivel: 'info',
        texto: `Amanhã tem ${feira.evento.titulo}. Confira os dados da sua banca.`,
        link: `/calendario/feira/${feira.evento.id}?config`,
      });
    }
  }

  for (const evento of eventosHoje) {
    if (minhasFeiras.some((f) => f.evento.id === evento.id)) continue;
    notificacoes.push({
      id: `hoje-${evento.id}`,
      icone: 'las la-calendar-day',
      nivel: 'destaque',
      texto: `Hoje: ${evento.titulo} às ${format(evento.data_hora, 'HH:mm')}.`,
      link: linkEvento(evento),
    });
  }

  const amanha = proximosEventos.filter((e) => isTomorrow(e.data_hora));
  for (const evento of amanha) {
    if (minhasFeiras.some((f) => f.evento.id === evento.id)) continue;
    notificacoes.push({
      id: `amanha-${evento.id}`,
      icone: 'las la-bell',
      nivel: 'info',
      texto: `Amanhã: ${evento.titulo} às ${format(evento.data_hora, 'HH:mm')}.`,
      link: linkEvento(evento),
    });
  }

  if (minhasFeiras.length && !perfil.nome_banca)
    notificacoes.push({
      id: 'banca-sem-nome',
      icone: 'las la-pen',
      nivel: 'info',
      texto: 'Sua banca ainda não tem nome. Personalize nome e logo para aparecer melhor na vitrine.',
      link: `/calendario/feira/${minhasFeiras[0].evento.id}?config`,
    });

  if (!perfil.celular)
    notificacoes.push({
      id: 'perfil-celular',
      icone: 'las la-user-edit',
      nivel: 'info',
      texto: 'Complete seu perfil com um celular para contato.',
      link: '/perfil/editar',
    });

  // Semana: eventos dos próximos 7 dias (para o resumo)
  const eventosSemana = await prisma.eventos.count({
    where: { data_hora: { gte: inicioHoje, lte: endOfDay(addDays(agora, 7)) } },
  });

  return {
    saudacao: `${format(agora, "EEEE, d 'de' LLLL", { locale: ptBR })}`,
    eventosHoje: eventosHoje.map(resumirEvento),
    proximosEventos: proximosEventos.map(resumirEvento),
    eventosSemana,
    minhasFeiras,
    anuncios,
    notificacoes,
    logoBanca: urlArquivo(perfil.logo_banca),
  };
}
