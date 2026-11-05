import { Form, Link, useLocation, useSearchParams } from '@remix-run/react';
import { useState } from 'react';

type Option = {
  label: string;
  value: string;
};

type FilterField = {
  name: string;
  label: string;
  type?: 'text' | 'date' | 'select';
  placeholder?: string;
  options?: Option[];
  /** Valor que significa "sem filtro" (ex.: 'TODOS'). Padrão: vazio. */
  emptyValue?: string;
};

type FiltroListagemProps = {
  fields: FilterField[];
  values?: Record<string, string | undefined>;
  title?: string;
  submitLabel?: string;
  /** Parâmetro de página desta listagem; é zerado ao aplicar/limpar filtros. */
  pageParam?: string;
};

/**
 * Bloco de FILTROS de uma listagem (o que aparece).
 * Ordenação e itens por página ficam no componente OrdenacaoListagem.
 *
 * Os demais parâmetros da URL (ordenação, filtros de outras listagens da
 * mesma página) são preservados ao aplicar ou limpar os filtros.
 */
export default function FiltroListagem({
  fields,
  values = {},
  title = 'Filtros',
  submitLabel = 'Aplicar',
  pageParam = 'pagina',
}: FiltroListagemProps) {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const nomesDosCampos = new Set(fields.map((field) => field.name));

  const filtrosAtivos = fields.filter((field) => {
    const value = String(values[field.name] ?? '').trim();
    return value !== '' && value !== (field.emptyValue ?? '');
  }).length;

  const [aberto, setAberto] = useState(filtrosAtivos > 0);

  // Parâmetros que não pertencem a este filtro: vão como hidden para não se perderem
  const parametrosPreservados = [...searchParams.entries()].filter(
    ([chave]) => !nomesDosCampos.has(chave) && chave !== pageParam
  );

  const urlLimpar = (() => {
    const params = new URLSearchParams(parametrosPreservados);
    const query = params.toString();
    return query ? `${location.pathname}?${query}` : location.pathname;
  })();

  return (
    <Form method='get' className='view-filters' preventScrollReset>
      {parametrosPreservados.map(([chave, valor]) => (
        <input key={`${chave}=${valor}`} type='hidden' name={chave} value={valor} />
      ))}

      <button
        type='button'
        className='view-filters-header'
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
      >
        <div className='view-filters-title'>
          <svg width='18' height='18' xmlns='http://www.w3.org/2000/svg' fillRule='evenodd' clipRule='evenodd'>
            <path d='M23 0l-9 14.146v7.73l-3.996 2.124v-9.853l-9.004-14.147h22zm-20.249 1l8.253 12.853v8.491l1.996-1.071v-7.419l8.229-12.854h-18.478z' />
          </svg>
          <h3>{title}</h3>
          {filtrosAtivos > 0 && (
            <span className='view-filters-badge'>
              {filtrosAtivos} ativo{filtrosAtivos === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <span className='view-filters-toggle'>
          {aberto ? 'Recolher' : 'Expandir'}
          <span className={`view-filters-seta${aberto ? ' aberto' : ''}`}>▼</span>
        </span>
      </button>

      {/* Mantém os campos no form mesmo recolhido, para não perder filtros ao enviar */}
      <div hidden={!aberto}>
        <div className='filter-groups'>
          {fields.map((field) => (
            <div className='filter-group' key={field.name}>
              <div className='filter-group-item'>
                <label htmlFor={field.name}>{field.label}</label>

                {field.type === 'select' ? (
                  <select id={field.name} name={field.name} defaultValue={values[field.name] ?? ''}>
                    {(field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={field.name}
                    type={field.type ?? 'text'}
                    name={field.name}
                    placeholder={field.placeholder}
                    defaultValue={values[field.name] ?? ''}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className='view-filters-actions'>
          <button type='submit' className='btn-filter-apply'>
            {submitLabel}
          </button>
          {filtrosAtivos > 0 && (
            <Link to={urlLimpar} className='btn-clear-filter' preventScrollReset>
              Limpar filtros
            </Link>
          )}
        </div>
      </div>
    </Form>
  );
}
