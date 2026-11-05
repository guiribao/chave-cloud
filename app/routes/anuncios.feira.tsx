import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import pegarAnunciosDoDia from '~/domain/Anuncio/pegar-anuncios-do-dia.server';
import { authenticator } from '~/secure/authentication.server';

// GET /anuncios/feira?eventoId=12 → anúncios de hoje (de uma feira ou de todas)
export async function loader({ request }: LoaderFunctionArgs) {
  const usuario = await authenticator.isAuthenticated(request);
  if (!usuario) return json({ anuncios: [] }, { status: 401 });

  const eventoId = Number(new URL(request.url).searchParams.get('eventoId')) || undefined;
  const anuncios = await pegarAnunciosDoDia(eventoId);

  return json({ anuncios }, { headers: { 'Cache-Control': 'no-store' } });
}
