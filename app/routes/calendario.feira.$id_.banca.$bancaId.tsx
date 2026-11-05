import { json } from '@remix-run/node';
import type {
  ActionFunctionArgs,
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from '@remix-run/node';
import { Link, useFetcher, useLoaderData, useRevalidator } from '@remix-run/react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEffect, useState } from 'react';

import feiraPageStyle from '~/assets/css/feira-page.css';
import bancaPageStyle from '~/assets/css/banca-page.css';
import alternarCurtidaAnuncio from '~/domain/Anuncio/alternar-curtida-anuncio.server';
import pegarBancaDaFeira from '~/domain/Anuncio/pegar-banca-da-feira.server';
import type { AnuncioDaBanca } from '~/domain/Anuncio/pegar-banca-da-feira.server';
import pegarPerfilPeloIdUsuario from '~/domain/Perfil/perfil-pelo-id-usuario.server';
import { authenticator } from '~/secure/authentication.server';

const ATUALIZAR_A_CADA_MS = 30000;

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: feiraPageStyle },
  { rel: 'stylesheet', href: bancaPageStyle },
];

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const nome = data?.banca?.nomeBanca || data?.banca?.nomeFeirante || 'Banca';
  return [{ title: `${nome} - ChaveCloud` }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const usuario = await authenticator.isAuthenticated(request, {
    failureRedirect: '/autentica/entrar',
  });

  const perfil = await pegarPerfilPeloIdUsuario(usuario.id);
  if (!perfil) throw new Response('Perfil não encontrado', { status: 403 });

  const banca = await pegarBancaDaFeira(Number(params.id), Number(params.bancaId), perfil.id);
  if (!banca) throw new Response('Banca não encontrada nesta feira', { status: 404 });

  return json({ banca, minhaBanca: banca.perfilId === perfil.id });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const usuario = await authenticator.isAuthenticated(request, {
    failureRedirect: '/autentica/entrar',
  });

  const perfil = await pegarPerfilPeloIdUsuario(usuario.id);
  if (!perfil) return json({ ok: false, erro: 'Perfil não encontrado.' }, { status: 403 });

  const form = await request.formData();
  if (form.get('_action') !== 'curtir') return json({ ok: false, erro: 'Ação inválida.' }, { status: 400 });

  const curtir = form.get('curtir');
  const resultado = await alternarCurtidaAnuncio({
    anuncioId: Number(form.get('anuncioId')),
    eventoId: Number(params.id),
    eventoFeiranteId: Number(params.bancaId),
    perfilId: perfil.id,
    curtir: curtir === null ? undefined : curtir === 'true',
  });

  return json(resultado, { status: resultado.ok ? 200 : 400 });
}

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export default function BancaDaFeira() {
  const { banca, minhaBanca } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [semLogo, setSemLogo] = useState(!banca.logo);

  const nomeExibido = banca.nomeBanca || banca.nomeFeirante;
  const totalCurtidas = banca.anuncios.reduce((total, a) => total + a.curtidas, 0);

  // Atualiza a lista de anúncios periodicamente (aba visível)
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && revalidator.state === 'idle') revalidator.revalidate();
    }, ATUALIZAR_A_CADA_MS);
    return () => clearInterval(timer);
  }, [revalidator]);

  return (
    <main>
      <div className='view_container'>
        <div className='view'>
          <div className='view-header'>
            <h1></h1>
            <Link to={`/calendario/feira/${banca.feira.id}`}>Voltar para a vitrine</Link>
          </div>

          <div className='view-body banca-pagina'>
            <section className={`banca-hero${minhaBanca ? ' minha-banca' : ''}`}>
              <div className='card-banca-toldo' aria-hidden='true' />

              <div className='banca-hero-conteudo'>
                <div className='banca-hero-logo'>
                  {semLogo ? (
                    <span aria-hidden='true'>{iniciais(nomeExibido)}</span>
                  ) : (
                    <img src={banca.logo!} alt={`Logo da banca ${nomeExibido}`} onError={() => setSemLogo(true)} />
                  )}
                </div>

                <div className='banca-hero-info'>
                  {minhaBanca && <span className='card-banca-selo'>Sua banca</span>}
                  <h1>{nomeExibido}</h1>
                  {banca.nomeBanca && <p className='banca-hero-dono'>por {banca.nomeFeirante}</p>}
                  <p className='banca-hero-feira'>
                    <span className='las la-store'></span> {banca.feira.titulo} ·{' '}
                    {format(new Date(banca.feira.dataHora), "d 'de' LLLL", { locale: ptBR })}
                  </p>

                  <div className='banca-hero-numeros'>
                    <span>
                      <strong>{banca.anuncios.length}</strong>{' '}
                      {banca.anuncios.length === 1 ? 'anúncio' : 'anúncios'}
                    </span>
                    <span>
                      <strong>{totalCurtidas}</strong> {totalCurtidas === 1 ? 'curtida' : 'curtidas'}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className='banca-anuncios'>
              <h2>Anúncios nesta feira</h2>

              {banca.anuncios.length === 0 ? (
                <div className='banca-anuncios-vazio'>
                  <span className='las la-bullhorn'></span>
                  <p>
                    {minhaBanca
                      ? 'Você ainda não fez anúncios nesta feira. Publique pelo painel "Anuncie sua banca" na página da feira.'
                      : 'Esta banca ainda não fez anúncios nesta feira.'}
                  </p>
                </div>
              ) : (
                <ul>
                  {banca.anuncios.map((anuncio) => (
                    <CardAnuncio key={anuncio.id} anuncio={anuncio} podeCurtir={!minhaBanca} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function CardAnuncio({ anuncio, podeCurtir }: { anuncio: AnuncioDaBanca; podeCurtir: boolean }) {
  const fetcher = useFetcher<{ ok: boolean; curtido?: boolean; curtidas?: number; erro?: string }>();

  // Atualização otimista: reflete o clique antes da resposta do servidor
  let curtido = anuncio.curtidoPorMim;
  let curtidas = anuncio.curtidas;

  if (fetcher.formData) {
    const novoEstado = fetcher.formData.get('curtir') === 'true';
    if (novoEstado !== anuncio.curtidoPorMim) curtidas += novoEstado ? 1 : -1;
    curtido = novoEstado;
  }
  // Após a resposta, o loader é revalidado e os valores reais chegam pelas props

  const criadoEm = new Date(anuncio.criadoEm);

  return (
    <li className='card-anuncio'>
      <p className='card-anuncio-mensagem'>{anuncio.mensagem}</p>

      <div className='card-anuncio-rodape'>
        <time dateTime={anuncio.criadoEm} title={format(criadoEm, "d/MM/yyyy 'às' HH:mm")}>
          {format(criadoEm, 'HH:mm')} ·{' '}
          {formatDistanceToNowStrict(criadoEm, { locale: ptBR, addSuffix: true })}
        </time>

        {podeCurtir ? (
          <fetcher.Form method='post'>
            <input type='hidden' name='_action' value='curtir' />
            <input type='hidden' name='anuncioId' value={anuncio.id} />
            <input type='hidden' name='curtir' value={String(!curtido)} />
            <button
              type='submit'
              className={`botao-curtir${curtido ? ' curtido' : ''}`}
              aria-pressed={curtido}
              aria-label={curtido ? 'Descurtir anúncio' : 'Curtir anúncio'}
            >
              <span className={curtido ? 'las la-heart' : 'lar la-heart'}></span>
              <span>{curtidas}</span>
            </button>
          </fetcher.Form>
        ) : (
          <span className='botao-curtir somente-leitura' title='Curtidas no seu anúncio'>
            <span className='las la-heart'></span>
            <span>{curtidas}</span>
          </span>
        )}
      </div>

      {fetcher.data && !fetcher.data.ok && <p className='mensagem-erro'>{fetcher.data.erro}</p>}
    </li>
  );
}
