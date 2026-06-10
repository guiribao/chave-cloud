import { prisma } from '~/secure/db.server';

type PerfilFilter = {
  nome?: string;
  grupo?: string;
  membro?: string;
  criadoDe?: string;
  criadoAte?: string;
  pagina?: number;
  porPagina?: number;
  ordenarPor?: 'id' | 'nome' | 'grupo' | 'membro' | 'criado_em';
  direcao?: 'asc' | 'desc';
};

type PerfilListagem = {
  perfis: any[];
  total: number;
};

export default async function pegarPerfis(filters: PerfilFilter = {}): Promise<PerfilListagem | null> {
  try {
    const where: any = {};
    const pagina = Math.max(1, filters.pagina ?? 1);
    const porPagina = Math.min(100, Math.max(5, filters.porPagina ?? 20));
    const ordenarPor = filters.ordenarPor ?? 'id';
    const direcao = filters.direcao ?? 'desc';

    if (filters.nome?.trim()) {
      where.OR = [
        { nome: { contains: filters.nome.trim(), mode: 'insensitive' } },
        { sobrenome: { contains: filters.nome.trim(), mode: 'insensitive' } },
      ];
    }

    if (filters.grupo && filters.grupo !== 'TODOS') {
      where.grupo = filters.grupo;
    }

    if (filters.membro === 'SIM') {
      where.membro = true;
    }

    if (filters.membro === 'NAO') {
      where.membro = false;
    }

    if (filters.criadoDe || filters.criadoAte) {
      where.criado_em = {
        ...(filters.criadoDe ? { gte: new Date(filters.criadoDe) } : {}),
        ...(filters.criadoAte ? { lte: new Date(`${filters.criadoAte}T23:59:59.999Z`) } : {}),
      };
    }

    const [perfis, total] = await Promise.all([
      prisma.perfil.findMany({
        where,
        include: {
          usuario: {
            select: {
              email: true,
              papel: true,
              criado_em: true,
              atualizado_em: true,
            },
          },
        },
        orderBy:
          ordenarPor === 'nome'
            ? [{ nome: direcao }, { sobrenome: direcao }]
            : [{ [ordenarPor]: direcao }],
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      prisma.perfil.count({ where }),
    ]);

    return { perfis, total };
  } catch (error) {
    return null;
  }
}
