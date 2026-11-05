import { TipoEvento } from '@prisma/client';
import { endOfDay, startOfDay } from 'date-fns';
import { prisma } from '~/secure/db.server';
import { urlArquivo } from '~/storage/storage.server';

export type AnuncioFeira = {
  id: number;
  mensagem: string;
  criadoEm: string;
  eventoId: number;
  eventoTitulo: string;
  banca: string;
  logo: string | null;
};

/**
 * Anúncios das feiras de hoje (opcionalmente de uma feira só).
 * Retorna apenas o anúncio mais recente de cada banca, do mais novo para o
 * mais antigo, para que o ciclo de notificações seja justo entre as bancas.
 */
export default async function pegarAnunciosDoDia(eventoId?: number, limite = 30): Promise<AnuncioFeira[]> {
  const agora = new Date();

  try {
    const anuncios = await prisma.anuncio_Feira.findMany({
      where: {
        ...(eventoId ? { eventoId } : {}),
        criado_em: { gte: startOfDay(agora) },
        evento: {
          tipo: TipoEvento.FEIRA,
          data_hora: { gte: startOfDay(agora), lte: endOfDay(agora) },
        },
      },
      orderBy: { criado_em: 'desc' },
      distinct: ['eventoFeiranteId'],
      take: limite,
      include: {
        evento: { select: { titulo: true } },
        eventoFeirante: {
          select: { perfil: { select: { nome: true, sobrenome: true, nome_banca: true, logo_banca: true } } },
        },
      },
    });

    return anuncios.map((anuncio) => {
      const perfil = anuncio.eventoFeirante.perfil;

      return {
        id: anuncio.id,
        mensagem: anuncio.mensagem,
        criadoEm: anuncio.criado_em.toISOString(),
        eventoId: anuncio.eventoId,
        eventoTitulo: anuncio.evento.titulo,
        banca: perfil.nome_banca?.trim() || `${perfil.nome} ${perfil.sobrenome}`.trim(),
        logo: urlArquivo(perfil.logo_banca),
      };
    });
  } catch (error) {
    console.warn('Erro ao buscar anúncios', error);
    return [];
  }
}
