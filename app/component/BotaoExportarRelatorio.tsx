import { useState, useRef, useEffect } from 'react';

export type FiltroExportacao = 'pagina-atual' | 'tudo-filtro';

type RelatorioAba = {
  nome: string;
  data: Array<Array<string | number>>;
};

type RelatorioPayload = {
  nome: string;
  tipo?: string;
  formato?: 'xlsx' | 'xls';
  data?: Array<Array<string | number>>;
  aba?: string;
  abas?: RelatorioAba[];
};

type BotaoExportarRelatorioProps = {
  label: string;
  gerarPayload: (filtro?: FiltroExportacao) => RelatorioPayload | null | Promise<RelatorioPayload | null>;
  disabled?: boolean;
  comOpcoes?: boolean;
};

const ESTILOS = {
  botaoPrincipal: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: '500',
    border: 'none',
    borderRadius: '6px',
    background: '#3772ff',
    color: 'white',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    fontFamily: 'Poppins, sans-serif',
  } as React.CSSProperties,
  botaoPrincipalHover: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: '500',
    border: 'none',
    borderRadius: '6px',
    background: '#2d5cc7',
    color: 'white',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    fontFamily: 'Poppins, sans-serif',
  } as React.CSSProperties,
  botaoPrincipalDisabled: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: '500',
    border: 'none',
    borderRadius: '6px',
    background: '#ccc',
    color: '#666',
    cursor: 'not-allowed',
    transition: 'background-color 0.2s ease',
    fontFamily: 'Poppins, sans-serif',
  } as React.CSSProperties,
  containerDropdown: {
    position: 'relative' as const,
    display: 'inline-block',
  },
  dropdown: {
    position: 'absolute' as const,
    top: 'calc(100% + 8px)',
    left: '0',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
    minWidth: '260px',
    overflow: 'hidden',
  } as React.CSSProperties,
  itemDropdown: {
    display: 'block',
    width: '100%',
    padding: '12px 14px',
    textAlign: 'left' as const,
    border: 'none',
    backgroundColor: 'white',
    color: '#333',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.15s ease',
    fontFamily: 'Poppins, sans-serif',
  } as React.CSSProperties,
  itemDropdownHover: {
    backgroundColor: '#f5f5f5',
    color: '#333',
    fontWeight: '500',
  } as React.CSSProperties,
  itemDropdownPrimeiro: {
    borderBottom: '1px solid #eee',
  } as React.CSSProperties,
  icone: {
    fontSize: '16px',
    lineHeight: '1',
  },
  setaDropdown: {
    display: 'inline-block',
    transition: 'transform 0.2s ease',
    fontSize: '12px',
  },
};

export default function BotaoExportarRelatorio({
  label,
  gerarPayload,
  disabled,
  comOpcoes = false,
}: BotaoExportarRelatorioProps) {
  const [isExportando, setIsExportando] = useState(false);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [botaoHover, setBotaoHover] = useState(false);
  const [item1Hover, setItem1Hover] = useState(false);
  const [item2Hover, setItem2Hover] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickFora(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownAberto(false);
      }
    }

    if (dropdownAberto) {
      document.addEventListener('mousedown', handleClickFora);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickFora);
    };
  }, [dropdownAberto]);

  async function exportar(filtro?: FiltroExportacao) {
    const payload = await Promise.resolve(gerarPayload(filtro));

    if (!payload) return;

    setIsExportando(true);
    setDropdownAberto(false);

    try {
      const response = await fetch('/relatorio/gerar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Nao foi possivel gerar o relatorio');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const extensao = payload.formato ?? 'xlsx';
      anchor.href = url;
      anchor.download = `${payload.nome || 'relatorio'}.${extensao}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Erro ao gerar relatorio. Tente novamente.');
    } finally {
      setIsExportando(false);
    }
  }

  if (!comOpcoes) {
    return (
      <button
        type='button'
        onClick={() => exportar()}
        disabled={disabled || isExportando}
        style={{
          ...(disabled || isExportando ? ESTILOS.botaoPrincipalDisabled : botaoHover ? ESTILOS.botaoPrincipalHover : ESTILOS.botaoPrincipal),
        }}
        onMouseEnter={() => !disabled && !isExportando && setBotaoHover(true)}
        onMouseLeave={() => setBotaoHover(false)}
      >
        <span style={ESTILOS.icone}>📥</span>
        {isExportando ? 'Exportando...' : label}
      </button>
    );
  }

  return (
    <div ref={dropdownRef} style={ESTILOS.containerDropdown}>
      <button
        type='button'
        onClick={() => !disabled && !isExportando && setDropdownAberto(!dropdownAberto)}
        disabled={disabled || isExportando}
        style={{
          ...(disabled || isExportando
            ? ESTILOS.botaoPrincipalDisabled
            : botaoHover || dropdownAberto
              ? ESTILOS.botaoPrincipalHover
              : ESTILOS.botaoPrincipal),
        }}
        onMouseEnter={() => !disabled && !isExportando && setBotaoHover(true)}
        onMouseLeave={() => setBotaoHover(false)}
      >
        <span style={ESTILOS.icone}>📥</span>
        {isExportando ? 'Exportando...' : label}
        <span
          style={{
            ...ESTILOS.setaDropdown,
            transform: dropdownAberto ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ▼
        </span>
      </button>

      {dropdownAberto && (
        <div style={ESTILOS.dropdown}>
          <button
            type='button'
            onClick={() => exportar('pagina-atual')}
            disabled={disabled || isExportando}
            style={{
              ...ESTILOS.itemDropdown,
              ...ESTILOS.itemDropdownPrimeiro,
              ...(item1Hover ? ESTILOS.itemDropdownHover : {}),
            }}
            onMouseEnter={() => setItem1Hover(true)}
            onMouseLeave={() => setItem1Hover(false)}
          >
            <span style={{ marginRight: '8px', fontSize: '16px' }}>📄</span>
            Página atual
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
              Apenas os dados visíveis
            </div>
          </button>

          <button
            type='button'
            onClick={() => exportar('tudo-filtro')}
            disabled={disabled || isExportando}
            style={{
              ...ESTILOS.itemDropdown,
              ...(item2Hover ? ESTILOS.itemDropdownHover : {}),
            }}
            onMouseEnter={() => setItem2Hover(true)}
            onMouseLeave={() => setItem2Hover(false)}
          >
            <span style={{ marginRight: '8px', fontSize: '16px' }}>📊</span>
            Tudo com filtro
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
              Sem limite de páginas
            </div>
          </button>
        </div>
      )}
    </div>
  );
}