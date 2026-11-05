import { startOfDay } from 'date-fns';
import { prisma } from '~/secure/db.server';

export default async function pegarDadosEventosDashboard() {
  try {
    // Próximos eventos: de hoje em diante (antes listava os mais antigos do banco)
    let eventos = await prisma.eventos.findMany({
      where: { data_hora: { gte: startOfDay(new Date()) } },
      take: 10,
      orderBy: { data_hora: 'asc' },
    });

    return eventos 

  } catch (error) {
    return null;
  }
}
