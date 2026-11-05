import { prisma } from '~/secure/db.server';
import { urlArquivo } from '~/storage/storage.server';

export type AnuncioDaBanca = {
  id: number;
  mensagem: string;
  criadoEm: string;
  curtidas: number;
  curtidoPorMim: boolean;
};

export type BancaDaFeira = {
  id: number;
  perfilId: number;
  nomeBanca: string | null;
  nomeFeirante: string;
  logo: string | null;
  feira: { id: number; titulo: string; dataHora: string };
  anuncios: AnuncioDaBanca[];
};

/**
 * Banca (Evento_Feirante) de uma feira com todos os anúncios que ela fez
 * naquela feira, do mais recente para o mais antigo, com as curtidas.
 */
export default async function pegarBancaDaFeira(
  eventoId: number,
  eventoFeiranteId: number,
  perfilLogadoId: number
): Promise<BancaDaFeira | null> {
  const banca = await prisma.evento_Feirante.findFirst({
    where: { id: eventoFeiranteId, eventoId },
    select: {
      id: true,
      perfilId: true,
      perfil: { select: { nome: true, sobrenome: true, nome_banca: true, logo_banca: true } },
      evento: { select: { id: true, titulo: true, data_hora: true } },
      Anuncios: {
        where: { eventoId },
        orderBy: { criado_em: 'desc' },
        select: {
          id: true,
          mensagem: true,
          criado_em: true,
          _count: { select: { curtidas: true } },
          curtidas: { where: { perfilId: perfilLogadoId }, select: { id: true } },
        },
      },
    },
  });

  if (!banca) return null;

  return {
    id: banca.id,
    perfilId: banca.perfilId,
    nomeBanca: banca.perfil.nome_banca?.trim() || null,
    nomeFeirante: `${banca.perfil.nome} ${banca.perfil.sobrenome}`.trim(),
    logo: urlArquivo(banca.perfil.logo_banca),
    feira: {
      id: banca.evento.id,
      titulo: banca.evento.titulo,
      dataHora: banca.evento.data_hora.toISOString(),
    },
    anuncios: banca.Anuncios.map((anuncio) => ({
      id: anuncio.id,
      mensagem: anuncio.mensagem,
      criadoEm: anuncio.criado_em.toISOString(),
      curtidas: anuncio._count.curtidas,
      curtidoPorMim: anuncio.curtidas.length > 0,
    })),
  };
}
