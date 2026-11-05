import { TipoEvento } from '@prisma/client';
import { startOfDay } from 'date-fns';
import { prisma } from '~/secure/db.server';

// Feiras de hoje em diante nas quais o perfil está cadastrado como feirante
export default async function pegarFeirasAtuaisFeirante(perfilId: number): Promise<{ id: number; data_hora: Date }[]> {
  try {
    return await prisma.eventos.findMany({
      where: {
        tipo: TipoEvento.FEIRA,
        data_hora: { gte: startOfDay(new Date()) },
        Feirantes: { some: { perfilId } },
      },
      select: { id: true, data_hora: true },
      orderBy: { data_hora: 'asc' },
    });
  } catch (error) {
    return [];
  }
}
