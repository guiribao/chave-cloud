import { useNavigate, useSearchParams } from '@remix-run/react';

type Option = {
  label: string;
  value: string;
};

type OrdenacaoListagemProps = {
  /** Campos pelos quais a listagem pode ser ordenada. */
  opcoes: Option[];
  ordenarPor: string;
  direcao: 'asc' | 'desc' | string;
  porPagina: number | string;
  opcoesPorPagina?: number[];
  /** Nomes dos parâmetros na URL (listagens na mesma página usam sufixos). */
  params?: {
    ordenarPor?: string;
    direcao?: string;
    porPagina?: string;
    pagina?: string;
  };
};

/**
 * Barra de ORDENAÇÃO de uma listagem (em que ordem e quantos por página).
 * Aplica na hora, preservando os filtros e voltando para a página 1.
 */
export default function OrdenacaoListagem({
  opcoes,
  ordenarPor,
  direcao,
  porPagina,
  opcoesPorPagina = [10, 20, 50, 100],
  params = {},
}: OrdenacaoListagemProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const nomes = {
    ordenarPor: params.ordenarPor ?? 'ordenarPor',
    direcao: params.direcao ?? 'direcao',
    porPagina: params.porPagina ?? 'porPagina',
    pagina: params.pagina ?? 'pagina',
  };

  function aplicar(alteracoes: Record<string, string>) {
    const novos = new URLSearchParams(searchParams);
    Object.entries(alteracoes).forEach(([chave, valor]) => novos.set(chave, valor));
    novos.delete(nomes.pagina);
    navigate(`?${novos.toString()}`, { preventScrollReset: true });
  }

  const crescente = direcao === 'asc';

  return (
    <div className='view-ordenacao' role='group' aria-label='Ordenação da listagem'>
      <label className='view-ordenacao-item'>
        <span>Ordenar por</span>
        <select value={ordenarPor} onChange={(e) => aplicar({ [nomes.ordenarPor]: e.target.value })}>
          {opcoes.map((opcao) => (
            <option key={opcao.value} value={opcao.value}>
              {opcao.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type='button'
        className='view-ordenacao-direcao'
        onClick={() => aplicar({ [nomes.direcao]: crescente ? 'desc' : 'asc' })}
        title={crescente ? 'Crescente (clique para decrescente)' : 'Decrescente (clique para crescente)'}
      >
        <span className={crescente ? 'las la-sort-amount-up-alt' : 'las la-sort-amount-down'}></span>
        {crescente ? 'Crescente' : 'Decrescente'}
      </button>

      <label className='view-ordenacao-item view-ordenacao-por-pagina'>
        <span>Itens por página</span>
        <select value={String(porPagina)} onChange={(e) => aplicar({ [nomes.porPagina]: e.target.value })}>
          {opcoesPorPagina.map((quantidade) => (
            <option key={quantidade} value={quantidade}>
              {quantidade}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
