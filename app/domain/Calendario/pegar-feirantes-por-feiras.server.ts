import { prisma } from '~/secure/db.server';
import { parseMonetaryNumber } from '~/shared/Number.util';
import { EXPORTACAO_MAX_REGISTROS } from '~/shared/Exportacao.util';

type PegarFeirantesArgs = {
  feiraId: string;
  nome?: string;
  statusCaixa?: string;
  pagina?: number;
  porPagina?: number;
  ordenarPor?: 'id' | 'nome' | 'nome_banca' | 'caixa_aberto';
  direcao?: 'asc' | 'desc';
  todos?: boolean; // exportação: ignora a paginação (até EXPORTACAO_MAX_REGISTROS)
};

export default async function pegarFeirantesPorFeira({
  feiraId,
  nome,
  statusCaixa,
  pagina = 1,
  porPagina = 20,
  ordenarPor = 'id',
  direcao = 'desc',
  todos = false,
}: PegarFeirantesArgs): Promise<{ feirantes: any[]; total: number } | null> {
  try {
    const where: any = {
      eventoId: Number(feiraId),
      ...(statusCaixa === 'ABERTO' ? { caixa_aberto: true } : {}),
      ...(statusCaixa === 'FECHADO' ? { caixa_aberto: false } : {}),
      ...(nome?.trim()
        ? {
            perfil: {
              OR: [
                { nome: { contains: nome.trim(), mode: 'insensitive' } },
                { sobrenome: { contains: nome.trim(), mode: 'insensitive' } },
                { nome_banca: { contains: nome.trim(), mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const paginaAjustada = Math.max(1, pagina);
    const porPaginaAjustada = Math.min(100, Math.max(5, porPagina));

    const [feirantes, total] = await Promise.all([
      prisma.evento_Feirante.findMany({
        where,
        include: {
          evento: true,
          perfil: true,
          Operacao: {
            include: {
              criado_por_perfil: {
                select: {
                  id: true,
                  nome: true,
                  sobrenome: true,
                },
              },
            },
          },
        },
        orderBy:
          ordenarPor === 'nome' || ordenarPor === 'nome_banca'
            ? {
                perfil: {
                  [ordenarPor]: direcao,
                },
              }
            : { [ordenarPor]: direcao },
        skip: todos ? 0 : (paginaAjustada - 1) * porPaginaAjustada,
        take: todos ? EXPORTACAO_MAX_REGISTROS : porPaginaAjustada,
      }),
      prisma.evento_Feirante.count({ where }),
    ]);


    for (let feirante of feirantes) {
      let soma = 0;
      feirante.Operacao.forEach(venda => soma += parseMonetaryNumber(venda.valor))
      feirante.valorVendas = soma;
      feirante.statusCaixa = feirante.caixa_aberto ? "ABERTO" : "FECHADO"
    }

    return { feirantes, total };

  } catch (error) {
    return null;
  }
}
