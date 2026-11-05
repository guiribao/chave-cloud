import type { UploadHandler } from '@remix-run/node';
import { randomUUID } from 'node:crypto';
import Jimp from 'jimp';
import { salvarArquivo } from './storage.server';

type RegraUpload = {
  pasta: string;
  formatos: Record<string, string>; // contentType -> extensão
  tamanhoMaximo: number;
  processar?: (dados: Buffer, contentType: string) => Promise<Buffer>;
};

const MB = 1024 * 1024;

const FORMATOS_IMAGEM = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
};

async function otimizarImagem(dados: Buffer, contentType: string, ladoMaximo = 500) {
  try {
    const imagem = await Jimp.read(dados);
    if (imagem.getWidth() > ladoMaximo || imagem.getHeight() > ladoMaximo)
      imagem.scaleToFit(ladoMaximo, ladoMaximo);
    imagem.quality(70);
    return await imagem.getBufferAsync(contentType);
  } catch {
    throw new Error('Não foi possível processar a imagem enviada.');
  }
}

/**
 * Regras por campo de arquivo. A chave é o prefixo do "name" do input
 * (ex.: logo_banca_12 usa a regra logo_banca). Para aceitar um novo tipo de
 * upload, basta adicionar uma regra aqui.
 */
const REGRAS: Record<string, RegraUpload> = {
  logo_banca: {
    pasta: 'logo_banca',
    formatos: FORMATOS_IMAGEM,
    tamanhoMaximo: 3 * MB,
    processar: (dados, contentType) => otimizarImagem(dados, contentType, 500),
  },
};

function regraDoCampo(nome: string) {
  const prefixo = Object.keys(REGRAS).find((p) => nome === p || nome.startsWith(`${p}_`));
  return prefixo ? REGRAS[prefixo] : null;
}

async function lerStream(data: AsyncIterable<Uint8Array>, limite = Infinity) {
  const partes: Uint8Array[] = [];
  let total = 0;

  for await (const parte of data) {
    total += parte.length;
    if (total > limite) throw new Error(`Arquivo grande demais. Utilize um arquivo de até ${Math.floor(limite / MB)}MB.`);
    partes.push(parte);
  }

  return Buffer.concat(partes);
}

/**
 * Upload handler para unstable_parseMultipartFormData.
 * - Campos de texto voltam como string.
 * - Arquivos de campos com regra são validados, processados e gravados no disco;
 *   o valor do campo passa a ser a chave do arquivo salvo.
 * - Input de arquivo vazio volta como undefined.
 */
export const uploadHandler: UploadHandler = async ({ name, data, filename, contentType }) => {
  if (filename === undefined) return (await lerStream(data)).toString('utf-8');

  const regra = regraDoCampo(name);

  if (!filename) {
    await lerStream(data);
    return undefined;
  }

  if (!regra) throw new Error(`O campo ${name} não aceita arquivos.`);

  const extensao = regra.formatos[contentType];
  if (!extensao) {
    const aceitos = Object.values(regra.formatos).map((e) => e.toUpperCase()).join(' ou ');
    throw new Error(`Formato do arquivo é inválido. Utilize ${aceitos}.`);
  }

  let dados = await lerStream(data, regra.tamanhoMaximo);
  if (dados.length === 0) throw new Error('Arquivo inválido.');

  if (regra.processar) dados = await regra.processar(dados, contentType);

  // Nome gerado no servidor: não sobrescreve arquivos de outros perfis,
  // evita path traversal e a imagem antiga presa no cache do navegador
  return await salvarArquivo(dados, `${regra.pasta}/${randomUUID()}.${extensao}`);
};
