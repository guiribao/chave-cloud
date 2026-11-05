import { Papel, TipoEvento } from '@prisma/client';
import { json } from '@remix-run/node';
import type { ActionFunction, LinksFunction, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData, useLocation, useSearchParams } from '@remix-run/react';
import { format, isToday, isTomorrow, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

import calendarioPageStyle from '~/assets/css/calendario-page.css';
import AnunciosFeira from '~/component/AnunciosFeira';
import DeletingModal from '~/component/DeletingModal';
import FiltroListagem from '~/component/FiltroListagem';
import deletarEventoPorId from '~/domain/Calendario/deletar-evento-por-id.server';
import pegarEventos, { type PeriodoEventos } from '~/domain/Calendario/pegar-eventos.server';
import pegarPerfilPeloIdUsuario from '~/domain/Perfil/perfil-pelo-id-usuario.server';
import { authenticator } from '~/secure/authentication.server';
import { prisma } from '~/secure/db.server';

export const meta: MetaFunction = () => {
  return [
    {
      charset: 'utf-8',
      title: 'Calendário - ChaveCloud',
      viewport: 'width=device-width, initial-scale=1',
    },
    {
      name: 'description',
      content: 'Gerenciamento de eventos do Chave',
    },
  ];
};

export const links: LinksFunction = () => [{ rel: 'stylesheet', href: calendarioPageStyle }];

const TIPO_EVENTO: Record<string, { label: string; icone: string; classe: string }> = {
  EVENTO: { label: 'Evento', icone: 'las la-calendar-day', classe: 'tipo-evento' },
  FEIRA: { label: 'Feira', icone: 'las la-store', classe: 'tipo-feira' },
  TRABALHO: { label: 'Trabalho', icone: 'las la-praying-hands', classe: 'tipo-trabalho' },
  TREINAMENTO: { label: 'Treinamento', icone: 'las la-chalkboard-teacher', classe: 'tipo-treinamento' },
};

const VESTIMENTA: Record<string, string> = {
  FARDA_AZUL: 'Farda azul',
  FARDA_BRANCA: 'Farda branca',
  ROUPA_BRANCA: 'Roupas claras/brancas',
  NAO_APLICA: '',
};

const PERIODOS: { value: PeriodoEventos; label: string }[] = [
  { value: 'proximos', label: 'Próximos' },
  { value: 'passados', label: 'Passados' },
  { value: 'todos', label: 'Todos' },
];

export const action: ActionFunction = async ({ request }) => {
  const usuario = await authenticator.isAuthenticated(request);
  if (usuario?.papel !== Papel.ADMIN) return json({ success: false }, { status: 403 });

  const form = await request.formData();
  const action = form.get('_action') as string;
  const eventoId = Number(form.get('resource') as string);

  if (action !== 'delete' || !eventoId) return json({ success: false }, { status: 400 });

  await deletarEventoPorId(eventoId);

  return json({ success: true });
};

export async function loader({ request }: LoaderFunctionArgs) {
  const usuario = await authenticator.isAuthenticated(request, {
    failureRedirect: '/autentica/entrar',
  });

  const url = new URL(request.url);
  const periodoParam = url.searchParams.get('periodo');
  const periodo: PeriodoEventos = PERIODOS.some((p) => p.value === periodoParam)
    ? (periodoParam as PeriodoEventos)
    : 'proximos';

  const filtros = {
    busca: url.searchParams.get('busca') ?? '',
    tipo: url.searchParams.get('tipo') ?? '',
    de: url.searchParams.get('de') ?? '',
    ate: url.searchParams.get('ate') ?? '',
  };

  const eventos = (await pegarEventos({ ...filtros, periodo })) ?? [];

  // Feiras em que o usuário logado é feirante (para destacar na lista)
  const perfil = await pegarPerfilPeloIdUsuario(usuario.id);
  const minhasFeiras = perfil
    ? (
        await prisma.evento_Feirante.findMany({
          where: { perfilId: perfil.id, eventoId: { in: eventos.map((e) => e.id) } },
          select: { eventoId: true },
        })
      ).map((f) => f.eventoId)
    : [];

  return json({
    eventos,
    periodo,
    filtros,
    minhasFeiras,
    isAdmin: usuario.papel === Papel.ADMIN,
  });
}

type EventoLista = {
  id: number;
  titulo: string;
  descricao: string | null;
  tipo: string;
  vestimenta: string;
  data_hora: string;
};

const primeiraMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

function agruparPorMes(eventos: EventoLista[]) {
  const grupos: { chave: string; titulo: string; eventos: EventoLista[] }[] = [];

  for (const evento of eventos) {
    const data = new Date(evento.data_hora);
    const chave = format(data, 'yyyy-MM');
    let grupo = grupos.find((g) => g.chave === chave);

    if (!grupo) {
      grupo = { chave, titulo: primeiraMaiuscula(format(data, "LLLL 'de' yyyy", { locale: ptBR })), eventos: [] };
      grupos.push(grupo);
    }

    grupo.eventos.push(evento);
  }

  return grupos;
}

function quandoRelativo(data: Date) {
  if (isToday(data)) return { texto: 'Hoje', classe: 'quando-hoje' };
  if (isTomorrow(data)) return { texto: 'Amanhã', classe: 'quando-breve' };

  const dias = differenceInCalendarDays(data, new Date());
  if (dias > 1 && dias <= 7) return { texto: `Em ${dias} dias`, classe: 'quando-breve' };

  return null;
}

function linkDoEvento(evento: EventoLista) {
  return evento.tipo === TipoEvento.FEIRA ? `/calendario/feira/${evento.id}` : `/calendario/${evento.id}`;
}

export default function CalendarioIndex() {
  const { eventos, periodo, filtros, minhasFeiras, isAdmin } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const [deletingItem, setDeletingItem] = useState<EventoLista | null>(null);

  const grupos = agruparPorMes(eventos as EventoLista[]);
  const proximoEvento =
    periodo === 'proximos' && !filtros.busca && !filtros.tipo && !filtros.de && !filtros.ate
      ? (eventos[0] as EventoLista | undefined)
      : undefined;

  function urlPeriodo(valor: PeriodoEventos) {
    const params = new URLSearchParams(searchParams);
    if (valor === 'proximos') params.delete('periodo');
    else params.set('periodo', valor);
    const query = params.toString();
    return query ? `${location.pathname}?${query}` : location.pathname;
  }

  return (
    <main>
      <AnunciosFeira mostrarFeira />
      {deletingItem && (
        <DeletingModal item={deletingItem} close={() => setDeletingItem(null)} entity='calendario' />
      )}

      <div className='view_container'>
        <div className='view calendario'>
          <div className='view-header'>
            <h1>Calendário</h1>
            {isAdmin && (
              <Link data-role='CRIAR_EVENTO' to={'/calendario/novo'}>
                + Evento
              </Link>
            )}
          </div>

          <div className='calendario-barra'>
            <nav className='calendario-periodos' aria-label='Período'>
              {PERIODOS.map((p) => (
                <Link
                  key={p.value}
                  to={urlPeriodo(p.value)}
                  className={periodo === p.value ? 'ativo' : ''}
                  aria-current={periodo === p.value ? 'page' : undefined}
                  preventScrollReset
                >
                  {p.label}
                </Link>
              ))}
            </nav>
            <span className='calendario-contador'>
              {eventos.length} {eventos.length === 1 ? 'evento' : 'eventos'}
            </span>
          </div>

          <FiltroListagem
            values={filtros}
            fields={[
              { name: 'busca', label: 'Buscar', type: 'text', placeholder: 'Nome ou descrição' },
              {
                name: 'tipo',
                label: 'Tipo',
                type: 'select',
                options: [
                  { value: '', label: 'Todos os tipos' },
                  ...Object.entries(TIPO_EVENTO).map(([value, t]) => ({ value, label: t.label })),
                ],
              },
              { name: 'de', label: 'De', type: 'date' },
              { name: 'ate', label: 'Até', type: 'date' },
            ]}
          />

          {proximoEvento && (
            <Link to={linkDoEvento(proximoEvento)} className='calendario-destaque'>
              <span className='calendario-destaque-rotulo'>Próximo evento</span>
              <strong>{proximoEvento.titulo}</strong>
              <span>
                {primeiraMaiuscula(
                  format(new Date(proximoEvento.data_hora), "EEEE, d 'de' LLLL 'às' HH:mm", { locale: ptBR })
                )}
              </span>
            </Link>
          )}

          <div className='calendario-lista'>
            {grupos.length === 0 && (
              <div className='calendario-vazio'>
                <span className='las la-calendar-times'></span>
                <p>
                  {periodo === 'proximos'
                    ? 'Nenhum evento programado com esses filtros.'
                    : 'Nenhum evento encontrado com esses filtros.'}
                </p>
                {periodo === 'proximos' && (
                  <Link to={urlPeriodo('passados')} preventScrollReset>
                    Ver eventos passados
                  </Link>
                )}
              </div>
            )}

            {grupos.map((grupo) => (
              <section key={grupo.chave} className='calendario-mes'>
                <h2>{grupo.titulo}</h2>

                <ul>
                  {grupo.eventos.map((evento) => {
                    const data = new Date(evento.data_hora);
                    const tipo = TIPO_EVENTO[evento.tipo] ?? TIPO_EVENTO.EVENTO;
                    const quando = quandoRelativo(data);
                    const souFeirante = minhasFeiras.includes(evento.id);
                    const vestimenta = VESTIMENTA[evento.vestimenta];

                    return (
                      <li key={evento.id} className={`evento-card ${tipo.classe}`}>
                        <div className='evento-data' aria-hidden='true'>
                          <span className='evento-data-semana'>{format(data, 'EEE', { locale: ptBR })}</span>
                          <span className='evento-data-dia'>{format(data, 'dd')}</span>
                          <span className='evento-data-hora'>{format(data, 'HH:mm')}</span>
                        </div>

                        <div className='evento-info'>
                          <div className='evento-etiquetas'>
                            <span className='evento-tipo'>
                              <span className={tipo.icone}></span> {tipo.label}
                            </span>
                            {quando && <span className={`evento-quando ${quando.classe}`}>{quando.texto}</span>}
                            {souFeirante && <span className='badge badge-green'>Você é feirante</span>}
                          </div>

                          <h3>
                            <Link to={linkDoEvento(evento)} className='evento-link'>
                              {evento.titulo}
                            </Link>
                          </h3>

                          {evento.descricao && <p className='evento-descricao'>{evento.descricao}</p>}

                          <p className='evento-meta'>
                            <span>
                              <span className='las la-clock'></span>{' '}
                              {format(data, "d 'de' LLLL 'às' HH:mm", { locale: ptBR })}
                            </span>
                            {vestimenta && (
                              <span>
                                <span className='las la-tshirt'></span> {vestimenta}
                              </span>
                            )}
                          </p>
                        </div>

                        {isAdmin && (
                          <div className='evento-acoes'>
                            <Link
                              data-role='EDITAR_EVENTO'
                              to={`/calendario/${evento.id}/editar`}
                              title='Editar evento'
                              aria-label={`Editar ${evento.titulo}`}
                            >
                              <i className='las la-pen'></i>
                            </Link>
                            <button
                              type='button'
                              data-role='DELETAR_EVENTO'
                              onClick={() => setDeletingItem(evento)}
                              title='Excluir evento'
                              aria-label={`Excluir ${evento.titulo}`}
                            >
                              <i className='las la-trash'></i>
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
