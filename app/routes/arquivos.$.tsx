import type { LoaderFunctionArgs } from '@remix-run/node';
import { createReadableStreamFromReadable } from '@remix-run/node';
import { abrirArquivo } from '~/storage/storage.server';

// Serve os arquivos gravados em STORAGE_DIR: /arquivos/<chave>
export async function loader({ params, request }: LoaderFunctionArgs) {
  const chave = params['*'];
  const arquivo = chave ? await abrirArquivo(chave) : null;

  if (!arquivo) throw new Response('Arquivo não encontrado', { status: 404 });

  const etag = `"${arquivo.tamanho.toString(16)}-${arquivo.modificadoEm.getTime().toString(16)}"`;

  if (request.headers.get('if-none-match') === etag) {
    arquivo.stream.destroy();
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(createReadableStreamFromReadable(arquivo.stream), {
    headers: {
      'Content-Type': arquivo.contentType,
      'Content-Length': String(arquivo.tamanho),
      // Nomes são únicos (uuid), então o conteúdo de uma URL nunca muda
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      ETag: etag,
    },
  });
}
