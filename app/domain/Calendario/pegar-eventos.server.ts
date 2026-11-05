import { prisma } from '~/secure/db.server';
import { Eventos, Prisma, TipoEvento } from '@prisma/client';
import { endOfDay, startOfDay } from 'date-fns';

export type PeriodoEventos = 'proximos' | 'passados' | 'todos';

export type FiltroEventos = {
  busca?: string;
  tipo?: string;
  periodo?: PeriodoEventos;
  de?: string; // yyyy-MM-dd
  ate?: string; // yyyy-MM-dd
};

function dataValida(valor?: string) {
  if (!valor) return null;
  const data = new Date(`${valor}T00:00:00`);
  return isNaN(data.getTime()) ? null : data;
}

/**
 * Lista eventos com filtros.
 * - proximos: de hoje em diante, do mais próximo para o mais distante
 * - passados: antes de hoje, do mais recente para o mais antigo
 * - todos: todos, do mais recente para o mais antigo
 */
export default async function pegarEventos(filtro: FiltroEventos = {}): Promise<Eventos[] | null> {
  try {
    const hoje = startOfDay(new Date());
    const periodo = filtro.periodo ?? 'todos';
    const where: Prisma.EventosWhereInput = {};
    const dataHora: Prisma.DateTimeFilter = {};

    if (periodo === 'proximos') dataHora.gte = hoje;
    if (periodo === 'passados') dataHora.lt = hoje;

    const de = dataValida(filtro.de);
    const ate = dataValida(filtro.ate);
    if (de && (!dataHora.gte || de > dataHora.gte)) dataHora.gte = startOfDay(de);
    if (ate) {
      const fimAte = endOfDay(ate);
      if (!dataHora.lt || fimAte < dataHora.lt) {
        delete dataHora.lt;
        dataHora.lte = fimAte;
      }
    }

    if (Object.keys(dataHora).length) where.data_hora = dataHora;

    if (filtro.tipo && filtro.tipo in TipoEvento) where.tipo = filtro.tipo as TipoEvento;

    const busca = filtro.busca?.trim();
    if (busca) {
      where.OR = [
        { titulo: { contains: busca, mode: 'insensitive' } },
        { descricao: { contains: busca, mode: 'insensitive' } },
      ];
    }

    const eventos = await prisma.eventos.findMany({
      where,
      orderBy: { data_hora: periodo === 'proximos' ? 'asc' : 'desc' },
    });

    return eventos || [];
  } catch (error) {
    return null;
  }
}
