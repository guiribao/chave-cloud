import { prisma } from '~/secure/db.server';
import { Operacao } from '@prisma/client';
import { EXPORTACAO_MAX_REGISTROS } from '~/shared/Exportacao.util';

type PegarOperacoesArgs = {
  pagina?: number;
  porPagina?: number;
  ordenarPor?: 'id' | 'valor' | 'tipo' | 'finalidade' | 'criado_em';
  direcao?: 'asc' | 'desc';
  todos?: boolean; // exportação: ignora a paginação (até EXPORTACAO_MAX_REGISTROS)
};

export default async function pegarOperacoes({
  pagina = 1,
  porPagina = 20,
  ordenarPor = 'criado_em',
  direcao = 'desc',
  todos = false,
}: PegarOperacoesArgs = {}): Promise<{ operacoes: Operacao[]; total: number } | null> {
  try {
    const paginaAjustada = Math.max(1, pagina);
    const porPaginaAjustada = Math.min(100, Math.max(5, porPagina));

    const [operacoes, total] = await Promise.all([
      prisma.operacao.findMany({
        include: {
          feirante: {
            include: { perfil: { select: { nome: true, sobrenome: true, nome_banca: true } } },
          },
          evento: true,
        },
        orderBy: { [ordenarPor]: direcao },
        skip: todos ? 0 : (paginaAjustada - 1) * porPaginaAjustada,
        take: todos ? EXPORTACAO_MAX_REGISTROS : porPaginaAjustada,
      }),
      prisma.operacao.count(),
    ]);

    return { operacoes: operacoes || [], total };
  } catch (error) {
    return null;
  }
}
