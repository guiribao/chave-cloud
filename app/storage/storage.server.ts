import { createReadStream } from 'node:fs';
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Armazenamento de arquivos em disco (local e produção).
 *
 * - STORAGE_DIR: pasta onde os arquivos são gravados. Em produção use um caminho
 *   absoluto FORA da pasta do deploy (ex.: /var/lib/chave-cloud/storage), para que
 *   os arquivos sobrevivam a novos deploys. Padrão: <raiz do projeto>/storage.
 * - No banco é gravada apenas a "chave" (caminho relativo dentro de STORAGE_DIR),
 *   ex.: logo_banca/9c1e...png. A URL pública é /arquivos/<chave>.
 */
export const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'));
export const ROTA_ARQUIVOS = '/arquivos';

export const CONTENT_TYPES: Record<string, string> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

/** Resolve a chave para um caminho absoluto, impedindo sair de STORAGE_DIR. */
export function caminhoDoArquivo(chave: string) {
  const normalizada = path.posix.normalize(String(chave).replace(/\\/g, '/')).replace(/^\/+/, '');
  const destino = path.resolve(STORAGE_DIR, normalizada);

  if (!normalizada || normalizada.startsWith('..') || !destino.startsWith(STORAGE_DIR + path.sep))
    throw new Error('Caminho de arquivo inválido.');

  return destino;
}

/** Grava o arquivo no disco e devolve a chave que deve ser salva no banco. */
export async function salvarArquivo(dados: Buffer, chave: string) {
  const destino = caminhoDoArquivo(chave);
  await mkdir(path.dirname(destino), { recursive: true });

  // Escreve num temporário e renomeia: nunca fica um arquivo pela metade
  const temporario = `${destino}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporario, dados);
  await rename(temporario, destino);

  return chave;
}

/** Remove um arquivo salvo anteriormente. Falhas são apenas logadas. */
export async function removerArquivo(chave?: string | null) {
  if (!chave) return;

  try {
    await unlink(caminhoDoArquivo(chave));
  } catch (error: any) {
    if (error?.code !== 'ENOENT') console.warn('Não foi possível remover o arquivo', chave, error);
  }
}

/** Abre o arquivo para leitura (usado pela rota /arquivos). Retorna null se não existir. */
export async function abrirArquivo(chave: string) {
  try {
    const caminho = caminhoDoArquivo(chave);
    const info = await stat(caminho);
    if (!info.isFile()) return null;

    return {
      stream: createReadStream(caminho),
      tamanho: info.size,
      modificadoEm: info.mtime,
      contentType: CONTENT_TYPES[path.extname(caminho).toLowerCase()] || 'application/octet-stream',
    };
  } catch {
    return null;
  }
}

/** Monta a URL pública de uma chave gravada no banco. */
export function urlArquivo(chave?: string | null) {
  if (!chave) return null;
  if (/^https?:\/\//.test(chave)) return chave;
  return `${ROTA_ARQUIVOS}/${chave.replace(/^\/+/, '')}`;
}
