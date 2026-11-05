import { Link } from '@remix-run/react';
import { differenceInCalendarDays, format, formatDistanceToNowStrict, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  EventoResumo,
  MinhaFeira,
  Notificacao,
} from '~/domain/Dashboard/pegar-dashboard-usuario.server';
import type { AnuncioFeira } from '~/domain/Anuncio/pegar-anuncios-do-dia.server';

type DashboardUsuarioProps = {
  nome: string;
  dashboard: {
    saudacao: string;
    eventosHoje: EventoResumo[];
    proximosEventos: EventoResumo[];
    eventosSemana: number;
    minhasFeiras: MinhaFeira[];
    anuncios: AnuncioFeira[];
    notificacoes: Notificacao[];
  } | null;
};

const TIPO: Record<string, { label: string; icone: string; classe: string }> = {
  EVENTO: { label: 'Evento', icone: 'las la-calendar-day', classe: 'tipo-evento' },
  FEIRA: { label: 'Feira', icone: 'las la-store', classe: 'tipo-feira' },
  TRABALHO: { label: 'Trabalho', icone: 'las la-praying-hands', classe: 'tipo-trabalho' },
  TREINAMENTO: { label: 'Treinamento', icone: 'las la-chalkboard-teacher', classe: 'tipo-treinamento' },
};

function linkEvento(evento: EventoResumo) {
  return evento.tipo === 'FEIRA' ? `/calendario/feira/${evento.id}` : `/calendario/${evento.id}`;
}

function quando(dataIso: string) {
  const data = new Date(dataIso);
  if (isToday(data)) return 'Hoje';
  if (isTomorrow(data)) return 'Amanhã';
  const dias = differenceInCalendarDays(data, new Date());
  if (dias > 1 && dias <= 7) return `Em ${dias} dias`;
  return null;
}

const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function saudacaoPorHorario() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function DashboardUsuario({ nome, dashboard }: DashboardUsuarioProps) {
  if (!dashboard) {
    return (
      <main className='dash'>
        <p>Não foi possível carregar seu início. Complete seu perfil e tente novamente.</p>
      </main>
    );
  }

  const { eventosHoje, proximosEventos, eventosSemana, minhasFeiras, anuncios, notificacoes } = dashboard;
  const feiraHoje = minhasFeiras.find((f) => f.hoje);

  return (
    <main className='dash'>
      {/* ---------- Boas-vindas ---------- */}
      <section className='dash-hero'>
        <div>
          <p className='dash-hero-data'>{dashboard.saudacao}</p>
          <h1>
            {saudacaoPorHorario()}
            {nome ? `, ${nome}` : ''}!
          </h1>
          <p className='dash-hero-resumo'>
            {eventosHoje.length
              ? `Hoje tem ${eventosHoje.length} ${eventosHoje.length === 1 ? 'evento' : 'eventos'} no Chave.`
              : 'Nenhum evento hoje.'}{' '}
            {eventosSemana > eventosHoje.length &&
              `${eventosSemana} nos próximos 7 dias.`}
          </p>
        </div>

        {feiraHoje && (
          <div className='dash-hero-acoes'>
            <Link to={`/calendario/feira/${feiraHoje.evento.id}?selling`} className='dash-botao dash-botao-claro'>
              <span className='las la-cash-register'></span> Cadastrar venda
            </Link>
            <Link to={`/calendario/feira/${feiraHoje.evento.id}`} className='dash-botao dash-botao-contorno'>
              <span className='las la-bullhorn'></span> Anunciar
            </Link>
          </div>
        )}
      </section>

      <div className='dash-grid'>
        <div className='dash-coluna'>
          {/* ---------- Hoje ---------- */}
          <section className='dash-bloco'>
            <header>
              <h2>Hoje</h2>
              <Link to='/calendario'>Ver calendário</Link>
            </header>

            {eventosHoje.length === 0 ? (
              <div className='dash-vazio'>
                <span className='las la-mug-hot'></span>
                <p>
                  Nada programado para hoje.
                  {proximosEventos[0] && (
                    <>
                      {' '}
                      O próximo é <Link to={linkEvento(proximosEventos[0])}>{proximosEventos[0].titulo}</Link>,{' '}
                      {format(new Date(proximosEventos[0].data_hora), "EEEE, d 'de' LLLL", { locale: ptBR })}.
                    </>
                  )}
                </p>
              </div>
            ) : (
              <ul className='dash-eventos-hoje'>
                {eventosHoje.map((evento) => {
                  const tipo = TIPO[evento.tipo] ?? TIPO.EVENTO;
                  return (
                    <li key={evento.id} className={tipo.classe}>
                      <Link to={linkEvento(evento)}>
                        <span className='dash-hora'>{format(new Date(evento.data_hora), 'HH:mm')}</span>
                        <span className='dash-evento-texto'>
                          <small>
                            <span className={tipo.icone}></span> {tipo.label}
                          </small>
                          <strong>{evento.titulo}</strong>
                          {evento.descricao && <span className='dash-descricao'>{evento.descricao}</span>}
                        </span>
                        <span className='las la-angle-right dash-seta'></span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ---------- Próximos eventos ---------- */}
          <section className='dash-bloco'>
            <header>
              <h2>Próximos eventos</h2>
              <Link to='/calendario'>Todos</Link>
            </header>

            {proximosEventos.length === 0 ? (
              <div className='dash-vazio'>
                <span className='las la-calendar'></span>
                <p>Nenhum evento programado por enquanto.</p>
              </div>
            ) : (
              <ul className='dash-proximos'>
                {proximosEventos.map((evento) => {
                  const data = new Date(evento.data_hora);
                  const tipo = TIPO[evento.tipo] ?? TIPO.EVENTO;
                  const rotulo = quando(evento.data_hora);
                  return (
                    <li key={evento.id} className={tipo.classe}>
                      <Link to={linkEvento(evento)}>
                        <span className='dash-data'>
                          <small>{format(data, 'LLL', { locale: ptBR })}</small>
                          <strong>{format(data, 'dd')}</strong>
                        </span>
                        <span className='dash-evento-texto'>
                          <strong>{evento.titulo}</strong>
                          <small>
                            {tipo.label} · {format(data, "EEEE 'às' HH:mm", { locale: ptBR })}
                          </small>
                        </span>
                        {rotulo && <span className='dash-quando'>{rotulo}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className='dash-coluna'>
          {/* ---------- Notificações ---------- */}
          <section className='dash-bloco'>
            <header>
              <h2>
                Notificações
                {notificacoes.length > 0 && <span className='dash-contador'>{notificacoes.length}</span>}
              </h2>
            </header>

            {notificacoes.length === 0 ? (
              <div className='dash-vazio'>
                <span className='las la-bell-slash'></span>
                <p>Tudo em dia por aqui.</p>
              </div>
            ) : (
              <ul className='dash-notificacoes'>
                {notificacoes.map((n) => {
                  const conteudo = (
                    <>
                      <span className={`dash-notificacao-icone ${n.icone}`}></span>
                      <span>{n.texto}</span>
                    </>
                  );
                  return (
                    <li key={n.id} className={`nivel-${n.nivel}`}>
                      {n.link ? <Link to={n.link}>{conteudo}</Link> : <div>{conteudo}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ---------- Minhas feiras ---------- */}
          {minhasFeiras.length > 0 && (
            <section className='dash-bloco'>
              <header>
                <h2>Minhas feiras</h2>
              </header>

              <ul className='dash-feiras'>
                {minhasFeiras.map((feira) => (
                  <li key={feira.bancaId} className={feira.hoje ? 'hoje' : ''}>
                    <div className='dash-feira-topo'>
                      <div>
                        <strong>{feira.evento.titulo}</strong>
                        <small>
                          {format(new Date(feira.evento.data_hora), "d 'de' LLLL 'às' HH:mm", { locale: ptBR })}
                        </small>
                      </div>
                      {feira.hoje ? (
                        <span className='badge badge-green'>Hoje</span>
                      ) : feira.caixaAberto && new Date(feira.evento.data_hora) < new Date() ? (
                        <span className='badge badge-red'>Caixa aberto</span>
                      ) : null}
                    </div>

                    <div className='dash-feira-numeros'>
                      <span>
                        <strong>{moeda(feira.vendas.total)}</strong>
                        <small>{feira.vendas.quantidade} vendas</small>
                      </span>
                      <span>
                        <strong>{feira.anuncios}</strong>
                        <small>anúncios</small>
                      </span>
                      <span>
                        <strong>{feira.curtidas}</strong>
                        <small>curtidas</small>
                      </span>
                    </div>

                    <div className='dash-feira-acoes'>
                      {feira.hoje && (
                        <Link to={`/calendario/feira/${feira.evento.id}?selling`}>
                          <span className='las la-plus'></span> Venda
                        </Link>
                      )}
                      <Link to={`/calendario/feira/${feira.evento.id}?consulting`}>
                        <span className='las la-receipt'></span> Extrato
                      </Link>
                      <Link to={`/calendario/feira/${feira.evento.id}/banca/${feira.bancaId}`}>
                        <span className='las la-store'></span> Minha banca
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ---------- Anúncios das bancas ---------- */}
          {anuncios.length > 0 && (
            <section className='dash-bloco'>
              <header>
                <h2>Na feira agora</h2>
              </header>

              <ul className='dash-anuncios'>
                {anuncios.map((anuncio) => (
                  <li key={anuncio.id}>
                    <Link to={`/calendario/feira/${anuncio.eventoId}/banca/${anuncio.eventoFeiranteId}`}>
                      <strong>{anuncio.banca}</strong>
                      <p>{anuncio.mensagem}</p>
                      <small>
                        {formatDistanceToNowStrict(new Date(anuncio.criadoEm), { locale: ptBR, addSuffix: true })}
                      </small>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
