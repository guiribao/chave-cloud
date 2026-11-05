// Utilitários de exportação de relatórios (usados no cliente)

/** Limite de registros na exportação "Tudo com filtro". */
export const EXPORTACAO_MAX_REGISTROS = 5000;

/**
 * Busca os dados do loader da rota atual com os MESMOS filtros da tela,
 * mas sem paginação (parâmetro exportar=<secao>). Usa o endpoint de dados
 * do Remix (?_data=<routeId>), que retorna o JSON do loader.
 */
export async function buscarDadosSemPaginacao<T>(routeId: string, secao: string): Promise<T> {
  const params = new URLSearchParams(window.location.search);
  params.set('exportar', secao);
  params.set('_data', routeId);

  const response = await fetch(`${window.location.pathname}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) throw new Error('Não foi possível buscar os dados para exportação.');

  return (await response.json()) as T;
}
