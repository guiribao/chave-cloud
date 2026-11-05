import { useFetcher } from '@remix-run/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Anuncio = {
  id: number;
  mensagem: string;
  criadoEm: string;
  eventoId: number;
  eventoTitulo: string;
  banca: string;
  logo: string | null;
};

interface AnunciosFeiraProps {
  eventoId?: number; // sem eventoId: anúncios de todas as feiras de hoje
  mostrarFeira?: boolean; // exibe o nome da feira (útil na página do calendário)
}

const TEMPO_POR_ANUNCIO_MS = 7000;
const PAUSA_ENTRE_CICLOS_MS = 20000;
const ATUALIZAR_A_CADA_MS = 30000;

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

/**
 * Notificações em ciclo com os anúncios (merchan) das bancas.
 * Mostra um anúncio por vez; ao fim do ciclo faz uma pausa e recomeça.
 * Os anúncios são atualizados periodicamente sem recarregar a página.
 */
export default function AnunciosFeira({ eventoId, mostrarFeira = false }: AnunciosFeiraProps) {
  const fetcher = useFetcher<{ anuncios: Anuncio[] }>();
  const url = `/anuncios/feira${eventoId ? `?eventoId=${eventoId}` : ''}`;

  const [indice, setIndice] = useState(0);
  const [visivel, setVisivel] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [fechado, setFechado] = useState(false);
  const vistos = useRef<Set<number>>(new Set());

  const anuncios = useMemo(() => fetcher.data?.anuncios ?? [], [fetcher.data]);
  const atual = anuncios.length ? anuncios[indice % anuncios.length] : null;

  // Busca inicial + atualização periódica (só com a aba visível)
  useEffect(() => {
    const carregar = () => {
      if (document.visibilityState === 'visible') fetcher.load(url);
    };

    carregar();
    const timer = setInterval(carregar, ATUALIZAR_A_CADA_MS);
    document.addEventListener('visibilitychange', carregar);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', carregar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Anúncio novo chegou: entra na frente do ciclo e reabre as notificações
  useEffect(() => {
    if (!anuncios.length) return;

    const novo = anuncios.find((a) => !vistos.current.has(a.id));
    const primeiraCarga = vistos.current.size === 0;
    anuncios.forEach((a) => vistos.current.add(a.id));

    if (novo && !primeiraCarga) {
      setIndice(anuncios.indexOf(novo));
      setFechado(false);
    }

    if (!visivel && !fechado) setVisivel(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anuncios]);

  // Ciclo: troca de anúncio a cada X segundos; ao fim da volta, pausa
  useEffect(() => {
    if (!anuncios.length || pausado || fechado) return;

    if (!visivel) {
      const t = setTimeout(() => setVisivel(true), PAUSA_ENTRE_CICLOS_MS);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      const fimDoCiclo = (indice + 1) % anuncios.length === 0;
      setIndice((i) => (i + 1) % anuncios.length);
      if (fimDoCiclo) setVisivel(false);
    }, TEMPO_POR_ANUNCIO_MS);

    return () => clearTimeout(t);
  }, [indice, visivel, pausado, fechado, anuncios.length]);

  if (!atual || fechado || !visivel) return null;

  return (
    <aside
      className='anuncio-feira'
      role='status'
      aria-live='polite'
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <div className='anuncio-feira-card' key={atual.id}>
        <div className='anuncio-feira-logo'>
          {atual.logo ? (
            <img src={atual.logo} alt='' onError={(e) => (e.currentTarget.style.display = 'none')} />
          ) : (
            <span>{iniciais(atual.banca)}</span>
          )}
        </div>

        <div className='anuncio-feira-conteudo'>
          <div className='anuncio-feira-topo'>
            <strong title={atual.banca}>{atual.banca}</strong>
            <small>
              {formatDistanceToNowStrict(new Date(atual.criadoEm), { locale: ptBR, addSuffix: true })}
            </small>
          </div>
          <p>{atual.mensagem}</p>
          {mostrarFeira && <small className='anuncio-feira-evento'>{atual.eventoTitulo}</small>}
        </div>

        <button
          type='button'
          className='anuncio-feira-fechar'
          aria-label='Fechar anúncios'
          onClick={() => setFechado(true)}
        >
          <span className='las la-times'></span>
        </button>

        {anuncios.length > 1 && (
          <span className='anuncio-feira-posicao'>
            {(indice % anuncios.length) + 1}/{anuncios.length}
          </span>
        )}

        <span
          className={`anuncio-feira-progresso${pausado ? ' pausado' : ''}`}
          style={{ animationDuration: `${TEMPO_POR_ANUNCIO_MS}ms` }}
        />
      </div>
    </aside>
  );
}
