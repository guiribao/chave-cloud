import { json } from '@remix-run/node';
import type {
  ActionFunction,
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';

import pegarPerfis from '~/domain/Perfil/pegar-perfis.server';
import gentePageStyle from '~/assets/css/gente-page.css';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DeletingModal from '~/component/DeletingModal';
import { useState } from 'react';
import deletarPerfilPorId from '~/domain/Perfil/deletar-perfil-por-id.server';
import FiltroListagem from '~/component/FiltroListagem';
import OrdenacaoListagem from '~/component/OrdenacaoListagem';
import BotaoExportarRelatorio, { type FiltroExportacao } from '~/component/BotaoExportarRelatorio';
import { EXPORTACAO_MAX_REGISTROS, buscarDadosSemPaginacao } from '~/shared/Exportacao.util';
import { authenticator } from '~/secure/authentication.server';
import { Papel } from '@prisma/client';
import Minicards from '~/component/Minicards';

type PerfilResumo = {
  id: number;
  foto: string;
  grupo: string;
  membro: boolean;
  nome: string;
  sobrenome: string;
  data_nascimento?: string | null;
  hora_nascimento?: string | null;
  cidade_nascimento?: string | null;
  estado_nascimento?: string | null;
  estado_civil?: string | null;
  nome_conjuge?: string | null;
  rg?: string | null;
  cpf?: string | null;
  email?: string | null;
  celular?: string | null;
  telefone_fixo?: string | null;
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  nome_referencia?: string | null;
  email_referencia?: string | null;
  telefone_referencia?: string | null;
  endereco_referencia?: string | null;
  parentesco_referencia?: string | null;
  data_fardamento?: string | null;
  local_fardamento?: string | null;
  bio?: string | null;
  profissao?: string | null;
  escolaridade?: string | null;
  medicacao_controlada?: boolean;
  nome_medicacao?: string | null;
  quadro_saude?: string | null;
  autorizacao_medico?: boolean | null;
  primeira_vez?: boolean;
  usuarioId?: number | null;
  nome_banca?: string | null;
  logo_banca?: string | null;
  criado_em: string;
  atualizado_em?: string;
  usuario?: {
    email: string;
    papel: string;
    criado_em: string;
    atualizado_em: string;
  } | null;
};

type GenteLoaderData = {
  perfis: PerfilResumo[];
  APP_URL?: string;
  paginacao: {
    pagina: number;
    porPagina: number;
    total: number;
    totalPaginas: number;
  };
  ordenacao: {
    ordenarPor: 'id' | 'nome' | 'grupo' | 'membro' | 'criado_em';
    direcao: 'asc' | 'desc';
  };
  filtros: {
    nome: string;
    grupo: string;
    membro: string;
    criadoDe: string;
    criadoAte: string;
    ordenarPor: string;
    direcao: string;
    porPagina: string;
  };
};

export const meta: MetaFunction = () => {
  return [
    {
      charset: 'utf-8',
      title: 'Gente - ChaveCloud',
      viewport: 'width=device-width, initial-scale=1',
    },
    {
      name: 'description',
      content: 'Gerenciamento de gente do Chave - usuários e perfis',
    },
  ];
};

export const links: LinksFunction = () => {
  return [{ rel: 'stylesheet', href: gentePageStyle }];
};

export const action: ActionFunction = async ({ request }) => {
  const form = await request.formData();
  const action: string = form.get('_action') as string;
  const operacaoId: number = Number(form.get('resource') as string);

  if (action !== 'delete' && !operacaoId) return { success: false };

  await deletarPerfilPorId(operacaoId);

  return { success: true };
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const nome = url.searchParams.get('nome') ?? '';
  const grupo = url.searchParams.get('grupo') ?? 'TODOS';
  const membro = url.searchParams.get('membro') ?? '';
  const criadoDe = url.searchParams.get('criadoDe') ?? '';
  const criadoAte = url.searchParams.get('criadoAte') ?? '';
  const pagina = Math.max(1, Number(url.searchParams.get('pagina') ?? '1'));
  const porPagina = Math.min(100, Math.max(5, Number(url.searchParams.get('porPagina') ?? '20')));
  const ordenarPor =
    (url.searchParams.get('ordenarPor') as 'id' | 'nome' | 'grupo' | 'membro' | 'criado_em') ??
    'criado_em';
  const direcao = (url.searchParams.get('direcao') as 'asc' | 'desc') ?? 'desc';

  // Somente ADMIN. A checagem precisa estar aqui: requisições de dados (?_data=)
  // executam só este loader, sem passar pela autorização do root.
  const usuario = await authenticator.isAuthenticated(request);
  if (usuario?.papel !== Papel.ADMIN) throw new Response('Permissão negada.', { status: 403 });

  // Exportação "Tudo com filtro": mesmos filtros, sem paginação
  const exportarTudo = url.searchParams.get('exportar') === 'tudo';

  const resultado = await pegarPerfis({
    todos: exportarTudo,
    nome,
    grupo,
    membro,
    criadoDe,
    criadoAte,
    pagina,
    porPagina,
    ordenarPor,
    direcao,
  });

  const perfis = resultado?.perfis ?? [];
  const total = resultado?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  let APP_URL = process.env.APP_URL;

  return json({
    perfis: perfis ?? [],
    APP_URL,
    paginacao: {
      pagina,
      porPagina,
      total,
      totalPaginas,
    },
    ordenacao: {
      ordenarPor,
      direcao,
    },
    filtros: {
      nome,
      grupo,
      membro,
      criadoDe,
      criadoAte,
      ordenarPor,
      direcao,
      porPagina: String(porPagina),
    },
  });
}

export default function GenteIndex() {
  const { perfis, APP_URL, filtros, paginacao, ordenacao } = useLoaderData<GenteLoaderData>();

  // Dados para modal deletar item
  let [deleting, setDeleting] = useState(false);
  let [deletingItem, setDeletingItem] = useState<PerfilResumo | null>(null);

  function openDeletingModal(perfil: PerfilResumo) {
    setDeleting(true);
    setDeletingItem(perfil);
  }

  function closeDeletingModal() {
    setDeleting(false);
    setDeletingItem(null);
  }

  async function gerarPayloadRelatorioGente(filtro?: FiltroExportacao) {
    const dataExtracao = new Date();
    const dataExtracaoTitulo = format(dataExtracao, 'yyyyMMdd_HHmmss');
    const dataExtracaoLabel = format(dataExtracao, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const tipoRelatorio = 'Relatorio de perfis';

    let dados = perfis;
    let total = paginacao.total;
    let pagina = paginacao.pagina;

    // "Tudo com filtro": busca todos os registros com os filtros atuais, sem paginação
    if (filtro === 'tudo-filtro') {
      try {
        const resultado = await buscarDadosSemPaginacao<GenteLoaderData>('routes/gente._index', 'tudo');
        dados = resultado.perfis;
        total = resultado.paginacao.total;
      } catch (error) {
        alert('Não foi possível buscar todos os registros para exportação. Tente novamente.');
        return null;
      }
    }

    if (!dados.length) {
      alert('Nao ha dados para exportar');
      return null;
    }

    const formatarData = (valor?: string | null) => {
      if (!valor) return '';
      return format(new Date(valor), 'dd/MM/yyyy HH:mm');
    };

    const formatarBoolean = (valor?: boolean | null) => {
      if (valor === true) return 'SIM';
      if (valor === false) return 'NAO';
      return '';
    };

    const dataDetalhado = [
      [
        'ID',
        'Nome',
        'Sobrenome',
        'Grupo',
        'Membro',
        'Data nascimento',
        'Hora nascimento',
        'Cidade nascimento',
        'Estado nascimento',
        'Estado civil',
        'Nome conjuge',
        'RG',
        'CPF',
        'Email',
        'Celular',
        'Telefone fixo',
        'CEP',
        'Endereco',
        'Numero',
        'Complemento',
        'Bairro',
        'Cidade',
        'Estado',
        'Nome referencia',
        'Email referencia',
        'Telefone referencia',
        'Endereco referencia',
        'Parentesco referencia',
        'Data fardamento',
        'Local fardamento',
        'Bio',
        'Profissao',
        'Escolaridade',
        'Medicacao controlada',
        'Nome medicacao',
        'Quadro saude',
        'Autorizacao medico',
        'Primeira vez',
        'Usuario ID',
        'Usuario email',
        'Usuario papel',
        'Criado em',
        'Atualizado em',
        'Criado usuario em',
        'Atualizado usuario em',
        'Nome banca',
        'Logo banca',
      ],
      ...dados.map((perfil: PerfilResumo) => [
        perfil.id,
        perfil.nome,
        perfil.sobrenome,
        perfil.grupo,
        formatarBoolean(perfil.membro),
        formatarData(perfil.data_nascimento),
        perfil.hora_nascimento ?? '',
        perfil.cidade_nascimento ?? '',
        perfil.estado_nascimento ?? '',
        perfil.estado_civil ?? '',
        perfil.nome_conjuge ?? '',
        perfil.rg ?? '',
        perfil.cpf ?? '',
        perfil.email ?? '',
        perfil.celular ?? '',
        perfil.telefone_fixo ?? '',
        perfil.cep ?? '',
        perfil.endereco ?? '',
        perfil.numero ?? '',
        perfil.complemento ?? '',
        perfil.bairro ?? '',
        perfil.cidade ?? '',
        perfil.estado ?? '',
        perfil.nome_referencia ?? '',
        perfil.email_referencia ?? '',
        perfil.telefone_referencia ?? '',
        perfil.endereco_referencia ?? '',
        perfil.parentesco_referencia ?? '',
        formatarData(perfil.data_fardamento),
        perfil.local_fardamento ?? '',
        perfil.bio ?? '',
        perfil.profissao ?? '',
        perfil.escolaridade ?? '',
        formatarBoolean(perfil.medicacao_controlada),
        perfil.nome_medicacao ?? '',
        perfil.quadro_saude ?? '',
        formatarBoolean(perfil.autorizacao_medico),
        formatarBoolean(perfil.primeira_vez),
        perfil.usuarioId ?? '',
        perfil.usuario?.email ?? '',
        perfil.usuario?.papel ?? '',
        formatarData(perfil.criado_em),
        formatarData(perfil.atualizado_em),
        formatarData(perfil.usuario?.criado_em),
        formatarData(perfil.usuario?.atualizado_em),
        perfil.nome_banca ?? '',
        perfil.logo_banca ?? '',
      ]),
    ];

    const dataResumo = [
      ['Indicador', 'Valor'],
      ['Tipo do relatorio', tipoRelatorio],
      ['Data da extracao', dataExtracaoLabel],
      ['Total filtrado', total],
      ['Pagina atual', filtro === 'tudo-filtro' ? `Todas (${dados.length} registros)` : pagina],
      ['Itens exportados', dados.length],
      ['Ordenacao', `${ordenacao.ordenarPor} (${ordenacao.direcao})`],
      ['Filtro nome', filtros.nome || '-'],
      ['Filtro grupo', filtros.grupo || '-'],
      ['Filtro membro', filtros.membro || '-'],
      ['Cadastro de', filtros.criadoDe || '-'],
      ['Cadastro ate', filtros.criadoAte || '-'],
      ['Modo exportacao', filtro === 'tudo-filtro' ? 'Tudo que corresponde ao filtro' : 'Só página atual'],
      ...(total > dados.length
        ? [['Atenção', `Exportados ${dados.length} de ${total} registros (limite de ${EXPORTACAO_MAX_REGISTROS})`]]
        : []),
    ];

    return {
      nome: `gente_perfis_${filtro === 'tudo-filtro' ? 'tudo' : `pagina${pagina}`}_${dataExtracaoTitulo}`,
      tipo: `${tipoRelatorio} - ${dataExtracaoLabel}`,
      formato: 'xlsx' as const,
      abas: [
        { nome: 'Resumo', data: dataResumo },
        { nome: 'Perfis', data: dataDetalhado },
      ],
      aba: 'Resumo',
      data: dataResumo,
    };
  }

  const totalMembrosPagina = perfis.filter((perfil) => perfil.membro).length;
  const totalVisitantesPagina = perfis.filter((perfil) => perfil.grupo === 'VISITANTE').length;
  const totalFardadosPagina = perfis.filter((perfil) => perfil.grupo === 'FARDADO').length;

  const minicardsData = [
    {
      quantidade: paginacao.total,
      label: 'Total filtrado',
      icon: 'las la-users',
    },
    {
      quantidade: totalMembrosPagina,
      label: 'Membros na pagina',
      icon: 'las la-user-check',
    },
    {
      quantidade: totalFardadosPagina,
      label: 'Fardados na pagina',
      icon: 'las la-shield-alt',
    },
    {
      quantidade: totalVisitantesPagina,
      label: 'Visitantes na pagina',
      icon: 'las la-user-friends',
    },
  ];

  function montarUrl(params: Record<string, string | number>) {
    const search = new URLSearchParams({
      nome: filtros.nome,
      grupo: filtros.grupo,
      membro: filtros.membro,
      criadoDe: filtros.criadoDe,
      criadoAte: filtros.criadoAte,
      porPagina: String(paginacao.porPagina),
      ordenarPor: ordenacao.ordenarPor,
      direcao: ordenacao.direcao,
      pagina: String(paginacao.pagina),
    });

    Object.entries(params).forEach(([chave, valor]) => {
      search.set(chave, String(valor));
    });

    return `/gente?${search.toString()}`;
  }

  return (
    <main>
      {deleting && deletingItem && (
        <DeletingModal item={deletingItem} close={closeDeletingModal} entity='gente' />
      )}

      <Minicards cards={minicardsData} role='MINICARDS_GENTE' />

      <div className='view_container'>
        <div className='view'>
          <div className='view-header'>
            <h1>Pessoas</h1>
            <div className='view-header-actions'>
              <BotaoExportarRelatorio
                label='Exportar (resumo + perfis)'
                gerarPayload={gerarPayloadRelatorioGente}
                disabled={!perfis.length}
                comOpcoes={true}
              />

               {/*<Link to={'/gente/usuario/novo'}>+ Usuário</Link> */}
            </div>
          </div>

          <FiltroListagem
            values={filtros}
            fields={[
              { name: 'nome', label: 'Nome', type: 'text', placeholder: 'Nome ou sobrenome' },
              {
                name: 'grupo',
                emptyValue: 'TODOS',
                label: 'Grupo',
                type: 'select',
                options: [
                  { value: 'TODOS', label: 'Todos' },
                  { value: 'FARDADO', label: 'Fardado' },
                  { value: 'VISITANTE', label: 'Visitante' },
                ],
              },
              {
                name: 'membro',
                label: 'Membro',
                type: 'select',
                options: [
                  { value: '', label: 'Todos' },
                  { value: 'SIM', label: 'Sim' },
                  { value: 'NAO', label: 'Nao' },
                ],
              },
              { name: 'criadoDe', label: 'Cadastro de', type: 'date' },
              { name: 'criadoAte', label: 'Cadastro ate', type: 'date' },
            ]}
          />

          <OrdenacaoListagem
            ordenarPor={ordenacao.ordenarPor}
            direcao={ordenacao.direcao}
            porPagina={paginacao.porPagina}
            opcoes={[
              { value: 'criado_em', label: 'Criado em' },
              { value: 'nome', label: 'Nome' },
              { value: 'grupo', label: 'Grupo' },
              { value: 'membro', label: 'Membro' },
              { value: 'id', label: 'ID' },
            ]}
          />

          <div className='view-body'>
            <table>
              <thead>
                <tr>
                  <td style={{ width: '50px' }}>#</td>
                  <td style={{ width: '40px' }}></td>
                  <td style={{ minWidth: '180px' }}>Nome</td>
                  <td style={{ minWidth: '140px' }}>Celular</td>
                  <td>Grupo</td>
                  <td>Membro</td>
                  <td>Cadastro</td>
                  <td style={{ width: '60px' }}></td>
                </tr>
              </thead>
              <tbody>
                {perfis.length === 0 && (
                  <tr>
                    <td style={{ textAlign: 'center', padding: '2em', color: '#667085' }} colSpan={8}>
                      Nenhum resultado encontrado
                    </td>
                  </tr>
                )}

                {perfis.map((perfil: PerfilResumo) => (
                  <tr key={perfil.id}>
                    <td style={{ color: '#9aa5b4', fontSize: '0.8rem' }}>{perfil.id}</td>
                    <td style={{ width: '40px', paddingRight: '0' }}>
                      <img
                        src={`${APP_URL}/${perfil.foto}`}
                        alt=''
                        width='28'
                        height='28'
                        style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }}
                      />
                    </td>
                    <td>
                      <Link to={`/gente/${perfil.id}`} style={{ fontWeight: 600 }}>
                        {perfil.nome} {perfil.sobrenome}
                      </Link>
                    </td>
                    <td style={{ color: '#475467' }}>{perfil.celular ?? '—'}</td>
                    <td>
                      {perfil.grupo === 'FARDADO' ? (
                        <span className='badge badge-blue'>Fardado</span>
                      ) : perfil.grupo === 'VISITANTE' ? (
                        <span className='badge badge-gray'>Visitante</span>
                      ) : (
                        <span className='badge badge-amber'>{perfil.grupo}</span>
                      )}
                    </td>
                    <td>
                      {perfil.membro ? (
                        <span className='badge badge-green'>Sim</span>
                      ) : (
                        <span className='badge badge-gray'>Não</span>
                      )}
                    </td>
                    <td
                      title={format(new Date(perfil.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      style={{ color: '#667085', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                    >
                      {format(new Date(perfil.criado_em), 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td>
                      <div id='actions'>
                        <Link to={`/gente/${perfil.id}`} title='Ver perfil'>
                          <i className='lar la-eye'></i>
                        </Link>
                        <button onClick={() => openDeletingModal(perfil)} title='Excluir'>
                          <i className='las la-trash'></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className='view-footer table-pagination'>
            <span>
              Mostrando {perfis.length} de {paginacao.total} registros
            </span>
            <div className='table-pagination-actions'>
              <Link
                to={montarUrl({ pagina: Math.max(1, paginacao.pagina - 1) })}
                aria-disabled={paginacao.pagina <= 1}
              >
                Anterior
              </Link>
              <strong>
                Pagina {paginacao.pagina} de {paginacao.totalPaginas}
              </strong>
              <Link
                to={montarUrl({ pagina: Math.min(paginacao.totalPaginas, paginacao.pagina + 1) })}
                aria-disabled={paginacao.pagina >= paginacao.totalPaginas}
              >
                Proxima
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
