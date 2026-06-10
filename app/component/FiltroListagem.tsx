import { Form } from '@remix-run/react';
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
};

type FiltroListagemProps = {
  fields: FilterField[];
  values?: Record<string, string | undefined>;
  title?: string;
  submitLabel?: string;
  clearPath?: string;
};

export default function FiltroListagem({
  fields,
  values = {},
  title = 'Filtros',
  submitLabel = 'Aplicar',
  clearPath,
}: FiltroListagemProps) {
  const filtrosAtivos = fields.reduce((total, field) => {
    const value = values[field.name];
    return value && String(value).trim() ? total + 1 : total;
  }, 0);

  const [aberto, setAberto] = useState(filtrosAtivos > 0);

  return (
    <Form method='get' className='view-filters'>
      <div className='view-filters-header' onClick={() => setAberto(!aberto)}>
        <div className='view-filters-title'>
          <svg
            width='18'
            height='18'
            xmlns='http://www.w3.org/2000/svg'
            fillRule='evenodd'
            clipRule='evenodd'
          >
            <path d='M23 0l-9 14.146v7.73l-3.996 2.124v-9.853l-9.004-14.147h22zm-20.249 1l8.253 12.853v8.491l1.996-1.071v-7.419l8.229-12.854h-18.478z' />
          </svg>
          <h3>{title}</h3>
          {filtrosAtivos > 0 && (
            <span className='view-filters-badge'>
              {filtrosAtivos} ativo{filtrosAtivos === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <span style={{ fontSize: '0.75rem', color: '#667085', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {aberto ? 'Recolher' : 'Expandir'}
          <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: aberto ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: '10px' }}>▼</span>
        </span>
      </div>

      {aberto && (
        <>
          <div className='filter-groups'>
            {fields.map((field) => (
              <div className='filter-group' key={field.name}>
                <div className='filter-group-item'>
                  <label htmlFor={field.name}>{field.label}</label>

                  {field.type === 'select' ? (
                    <select
                      id={field.name}
                      name={field.name}
                      defaultValue={values[field.name] ?? ''}
                    >
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
            {clearPath ? (
              <a href={clearPath} className='btn-clear-filter'>
                Limpar
              </a>
            ) : null}
          </div>
        </>
      )}
    </Form>
  );
}