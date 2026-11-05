import { Prisma } from '@prisma/client';
import { prisma } from '~/secure/db.server';

type Resultado =
  | { ok: true; curtido: boolean; curtidas: number }
  | { ok: false; erro: string };

/**
 * Curte ou descurte um anúncio. O anúncio precisa ser da banca/feira
 * informadas, e o feirante não pode curtir os próprios anúncios.
 * Se `curtir` for informado, aplica esse estado (idempotente).
 */
export default async function alternarCurtidaAnuncio({
  anuncioId,
  eventoId,
  eventoFeiranteId,
  perfilId,
  curtir,
}: {
  anuncioId: number;
  eventoId: number;
  eventoFeiranteId: number;
  perfilId: number;
  curtir?: boolean;
}): Promise<Resultado> {
  const anuncio = await prisma.anuncio_Feira.findFirst({
    where: { id: anuncioId, eventoId, eventoFeiranteId },
    select: { id: true, eventoFeirante: { select: { perfilId: true } } },
  });

  if (!anuncio) return { ok: false, erro: 'Anúncio não encontrado.' };
  if (anuncio.eventoFeirante.perfilId === perfilId)
    return { ok: false, erro: 'Você não pode curtir seus próprios anúncios.' };

  const existente = await prisma.anuncio_Curtida.findUnique({
    where: { anuncioId_perfilId: { anuncioId, perfilId } },
    select: { id: true },
  });

  const deveCurtir = curtir ?? !existente;

  if (deveCurtir && !existente) {
    try {
      await prisma.anuncio_Curtida.create({ data: { anuncioId, perfilId } });
    } catch (error) {
      // Clique duplo: a curtida já foi criada por outra requisição
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
  }

  if (!deveCurtir && existente) {
    await prisma.anuncio_Curtida.deleteMany({ where: { anuncioId, perfilId } });
  }

  const curtidas = await prisma.anuncio_Curtida.count({ where: { anuncioId } });

  return { ok: true, curtido: deveCurtir, curtidas };
}
