import { json } from '@remix-run/node';
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import BotaoExportarRelatorio, { type FiltroExportacao } from '~/component/BotaoExportarRelatorio';
import { EXPORTACAO_MAX_REGISTROS, buscarDadosSemPaginacao } from '~/shared/Exportacao.util';
import { authenticator } from '~/secure/authentication.server';
import { Papel } from '@prisma/client';
import pegarEventosFeiras from '~/domain/Calendario/pegar-eventos-feiras.server';
import pegarFeirantesPorFeira from '~/domain/Calendario/pegar-feirantes-por-feiras.server';
import pegarOperacoes from '~/domain/Financeiro/pegar-operacoes.server';
import { calcularCaixaFeirante, formatarColunaDeValor } from '~/shared/Feira.util';
import { gerarDescricaoOperacaoFeira } from '~/shared/Operacao.util';
import { parseMonetaryNumber } from '~/shared/Number.util';
import FiltroListagem from '~/component/FiltroListagem';
import OrdenacaoListagem from '~/component/OrdenacaoListagem';
import Minicards from '~/component/Minicards';

type FeiraOption = {
  id: number;
  titulo: string;
};

type OperacaoFeiraResumo = {
  id: number;
  tipo: string;
  finalidade: string;
  forma_pagamento: string;
  valor: number | string;
  criado_em: string;
  criado_por?: number;
  descricao?: string | null;
  produto?: string | null;
  nome_cliente?: string | null;
  observacao?: string | null;
  criado_por_perfil?: {
    id: number;
    nome: string;
    sobrenome: string;
  };
};

type OperacaoResumo = {
  id: number;
  descricao?: string | null;
  tipo: string;
  finalidade: string;
  valor: number | string;
  criado_em: string;
  feirante?: {
    perfil?: {
      nome: string;
      sobrenome: string;
      nome_banca?: string;
    };
  } | null;
  evento?: {
    titulo: string;
  } | null;
};

type FeiranteResumo = {
  id: number;
  eventoId: number;
  perfilId: number;
  evento: {
    titulo: string;
    data_hora: string;
  };
  perfil: {
    nome: string;
    sobrenome: string;
    nome_banca?: string;
    celular?: string;
    email?: string;
    cpf?: string;
    rg?: string;
  };
  Operacao: OperacaoFeiraResumo[];
  pagamento_banco: string;
  pagamento_agencia: string;
  pagamento_conta: string;
  pagamento_chave_pix: string;
  valorVendas: number;
  statusCaixa: string;
  caixa_aberto: boolean;
};

type FinanceiroLoaderData = {
  operacoes: OperacaoResumo[];
  feiras: FeiraOption[];
  feirantes: FeiranteResumo[];
  paginacaoGeral: {
    pagina: number;
    porPagina: number;
    total: number;
    totalPaginas: number;
  };
  paginacaoFeira: {
    pagina: number;
    porPagina: number;
    total: number;
    totalPaginas: number;
  };
  filtros: {
    ordenarPorGeral: string;
    direcaoGeral: string;
    paginaGeral: string;
    porPaginaGeral: string;
    feiraId: string;
    nome: string;
    statusCaixa: string;
    ordenarPorFeira: string;
    direcaoFeira: string;
    paginaFeira: string;
    porPaginaFeira: string;
  };
};

export const meta: MetaFunction = () => {
  return [
    {
      charset: 'utf-8',
      title: 'Financeiro - ChaveCloud',
      viewport: 'width=device-width, initial-scale=1',
    },
    {
      name: 'description',
      content: 'Gerenciamento de operações financeiras de entrada e saída do Chave',
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const paginaGeral = Math.max(1, Number(url.searchParams.get('paginaGeral') ?? '1'));
  const porPaginaGeral = Math.min(
    100,
    Math.max(5, Number(url.searchParams.get('porPaginaGeral') ?? '20'))
  );
  const ordenarPorGeral =
    (url.searchParams.get('ordenarPorGeral') as
      | 'id'
      | 'valor'
      | 'tipo'
      | 'finalidade'
      | 'criado_em') ?? 'criado_em';
  const direcaoGeral = (url.searchParams.get('direcaoGeral') as 'asc' | 'desc') ?? 'desc';

  const feiraId = url.searchParams.get('feiraId') ?? '0';
  const nome = url.searchParams.get('nome') ?? '';
  const statusCaixa = url.searchParams.get('statusCaixa') ?? '';
  const paginaFeira = Math.max(1, Number(url.searchParams.get('paginaFeira') ?? '1'));
  const porPaginaFeira = Math.min(
    100,
    Math.max(5, Number(url.searchParams.get('porPaginaFeira') ?? '20'))
  );
  const ordenarPorFeira =
    (url.searchParams.get('ordenarPorFeira') as 'id' | 'nome' | 'nome_banca' | 'caixa_aberto') ??
    'id';
  const direcaoFeira = (url.searchParams.get('direcaoFeira') as 'asc' | 'desc') ?? 'desc';

  // Somente ADMIN. A checagem precisa estar aqui: requisições de dados (?_data=)
  // executam só este loader, sem passar pela autorização do root.
  const usuario = await authenticator.isAuthenticated(request);
  if (usuario?.papel !== Papel.ADMIN) throw new Response('Permissão negada.', { status: 403 });

  // Exportação "Tudo com filtro": mesmos filtros, sem paginação
  const exportar = url.searchParams.get('exportar'); // 'geral' | 'feira' | null

  const resultadoOperacoes = await pegarOperacoes({
    todos: exportar === 'geral',
    pagina: paginaGeral,
    porPagina: porPaginaGeral,
    ordenarPor: ordenarPorGeral,
    direcao: direcaoGeral,
  });

  const operacoes = (resultadoOperacoes?.operacoes ?? []) as OperacaoResumo[];
  const totalOperacoes = resultadoOperacoes?.total ?? 0;
  const totalPaginasGeral = Math.max(1, Math.ceil(totalOperacoes / porPaginaGeral));

  const feiras = (await pegarEventosFeiras()) ?? [];
  let feirantes: FeiranteResumo[] = [];
  let totalFeirantes = 0;

  if (feiraId !== '0') {
    const resultadoFeirantes = await pegarFeirantesPorFeira({
      todos: exportar === 'feira',
      feiraId,
      nome,
      statusCaixa,
      pagina: paginaFeira,
      porPagina: porPaginaFeira,
      ordenarPor: ordenarPorFeira,
      direcao: direcaoFeira,
    });

    feirantes = (resultadoFeirantes?.feirantes ?? []) as FeiranteResumo[];
    totalFeirantes = resultadoFeirantes?.total ?? 0;
  }

  const totalPaginasFeira = Math.max(1, Math.ceil(totalFeirantes / porPaginaFeira));

  return json({
    operacoes,
    feiras,
    feirantes,
    paginacaoGeral: {
      pagina: paginaGeral,
      porPagina: porPaginaGeral,
      total: totalOperacoes,
      totalPaginas: totalPaginasGeral,
    },
    paginacaoFeira: {
      pagina: paginaFeira,
      porPagina: porPaginaFeira,
      total: totalFeirantes,
      totalPaginas: totalPaginasFeira,
    },
    filtros: {
      ordenarPorGeral,
      direcaoGeral,
      paginaGeral: String(paginaGeral),
      porPaginaGeral: String(porPaginaGeral),
      feiraId,
      nome,
      statusCaixa,
      ordenarPorFeira,
      direcaoFeira,
      paginaFeira: String(paginaFeira),
      porPaginaFeira: String(porPaginaFeira),
    },
  });
}

export default function FinanceiroIndex() {
  const { operacoes, feiras, feirantes, filtros, paginacaoGeral, paginacaoFeira } =
    useLoaderData<FinanceiroLoaderData>();

  async function fecharCaixaFeirante(feiraId: number, perfilId: number) {
    await fetch(`/feira/${feiraId}/feirante/${perfilId}/fechar`);
    window.location.reload();
  }

  const totalEntradasPagina = operacoes.filter((operacao) => operacao.tipo === 'ENTRADA').length;
  const totalSaidasPagina = operacoes.filter((operacao) => operacao.tipo === 'SAIDA').length;
  const totalValorOperacoesPagina = operacoes.reduce(
    (total, operacao) => total + parseMonetaryNumber(operacao.valor),
    0
  );
  const totalFeirasAbertasPagina = feirantes.filter((feirante) => feirante.caixa_aberto).length;

  const minicardsData = [
    {
      quantidade: paginacaoGeral.total,
      label: 'Operações filtradas',
      icon: 'las la-receipt',
    },
    {
      quantidade: totalEntradasPagina,
      label: 'Entradas na página',
      icon: 'las la-file-import',
    },
    {
      quantidade: totalSaidasPagina,
      label: 'Saídas na página',
      icon: 'las la-file-export',
    },
    {
      quantidade: totalValorOperacoesPagina.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
      label: 'Valor na página',
      icon: 'las la-coins',
    },
    {
      quantidade: paginacaoFeira.total,
      label: 'Feirantes filtrados',
      icon: 'las la-store-alt',
    },
    {
      quantidade: totalFeirasAbertasPagina,
      label: 'Caixas abertos',
      icon: 'las la-lock-open',
    },
  ];

  async function gerarPayloadRelatorioGeral(filtro?: FiltroExportacao) {
    const exportarTudo = filtro === 'tudo-filtro';
    let dados = operacoes;
    let total = paginacaoGeral.total;

    // "Tudo com filtro": busca todas as operações com a ordenação atual, sem paginação
    if (exportarTudo) {
      try {
        const resultado = await buscarDadosSemPaginacao<FinanceiroLoaderData>('routes/financeiro._index', 'geral');
        dados = resultado.operacoes;
        total = resultado.paginacaoGeral.total;
      } catch (error) {
        alert('Não foi possível buscar todos os registros para exportação. Tente novamente.');
        return null;
      }
    }

    if (!dados.length) {
      alert('Nao ha dados para exportar');
      return null;
    }

    const totalEntradas = dados.filter((operacao) => operacao.tipo === 'ENTRADA').length;
    const totalSaidas = dados.filter((operacao) => operacao.tipo === 'SAIDA').length;
    const totalValor = dados.reduce((soma, operacao) => soma + parseMonetaryNumber(operacao.valor), 0);
    const escopo = exportarTudo ? 'exportadas' : 'na pagina';

    const dataExtracao = new Date();
    const dataExtracaoTitulo = format(dataExtracao, 'yyyyMMdd_HHmmss');
    const dataExtracaoLabel = format(dataExtracao, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const tipoRelatorio = 'Relatorio financeiro geral';

    const dataResumo = [
      ['Indicador', 'Valor'],
      ['Tipo do relatorio', tipoRelatorio],
      ['Data da extracao', dataExtracaoLabel],
      ['Total filtrado', total],
      ['Pagina atual', exportarTudo ? `Todas (${dados.length} registros)` : paginacaoGeral.pagina],
      ['Itens exportados', dados.length],
      ['Ordenacao', `${filtros.ordenarPorGeral} (${filtros.direcaoGeral})`],
      [`Entradas ${escopo}`, totalEntradas],
      [`Saidas ${escopo}`, totalSaidas],
      [
        `Valor total ${escopo}`,
        totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      ],
      ['Modo exportacao', exportarTudo ? 'Tudo que corresponde ao filtro' : 'Só página atual'],
      ...(total > dados.length
        ? [['Atenção', `Exportados ${dados.length} de ${total} registros (limite de ${EXPORTACAO_MAX_REGISTROS})`]]
        : []),
    ];

    const dataOperacoes = [
      ['ID', 'Descricao', 'Tipo', 'Finalidade', 'Valor', 'Criado em'],
      ...dados.map((operacao) => {
        const descricao =
          operacao.finalidade === 'FEIRA'
            ? gerarDescricaoOperacaoFeira(operacao)
            : operacao.descricao ?? '';

        return [
          operacao.id,
          descricao,
          operacao.tipo,
          operacao.finalidade,
          parseMonetaryNumber(operacao.valor).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }),
          new Date(operacao.criado_em).toLocaleString('pt-BR'),
        ];
      }),
    ];

    return {
      nome: `financeiro_geral_${exportarTudo ? 'tudo' : `pagina${paginacaoGeral.pagina}`}_${dataExtracaoTitulo}`,
      tipo: `${tipoRelatorio} - ${dataExtracaoLabel}`,
      formato: 'xlsx' as const,
      abas: [
        { nome: 'Resumo', data: dataResumo },
        { nome: 'Operacoes', data: dataOperacoes },
      ],
      aba: 'Resumo',
      data: dataResumo,
    };
  }

  async function gerarPayloadRelatorioFeira(filtro?: FiltroExportacao) {
    const exportarTudo = filtro === 'tudo-filtro';
    let dadosFeirantes = feirantes;
    let total = paginacaoFeira.total;

    // "Tudo com filtro": busca todos os feirantes da feira com os filtros atuais, sem paginação
    if (exportarTudo) {
      try {
        const resultado = await buscarDadosSemPaginacao<FinanceiroLoaderData>('routes/financeiro._index', 'feira');
        dadosFeirantes = resultado.feirantes;
        total = resultado.paginacaoFeira.total;
      } catch (error) {
        alert('Não foi possível buscar todos os registros para exportação. Tente novamente.');
        return null;
      }
    }

    if (!dadosFeirantes.length) {
      alert('Nao ha dados para exportar');
      return null;
    }

    const dataExtracao = new Date();
    const dataExtracaoTitulo = format(dataExtracao, 'yyyyMMdd_HHmmss');
    const dataExtracaoLabel = format(dataExtracao, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const tipoRelatorio = 'Relatorio financeiro de feira';

    const feiraSelecionada = feiras.find(
      (feira: FeiraOption) => String(feira.id) === filtros.feiraId
    );

    const dataResumo = [
      ['Indicador', 'Valor'],
      ['Tipo do relatorio', tipoRelatorio],
      ['Data da extracao', dataExtracaoLabel],
      ['Feira selecionada', feiraSelecionada?.titulo ?? filtros.feiraId],
      ['Total filtrado', total],
      ['Pagina atual', exportarTudo ? `Todas (${dadosFeirantes.length} registros)` : paginacaoFeira.pagina],
      ['Itens exportados', dadosFeirantes.length],
      ['Ordenacao', `${filtros.ordenarPorFeira} (${filtros.direcaoFeira})`],
      ['Filtro nome', filtros.nome || '-'],
      ['Filtro status caixa', filtros.statusCaixa || 'Todos'],
      ['Modo exportacao', exportarTudo ? 'Tudo que corresponde ao filtro' : 'Só página atual'],
      ...(total > dadosFeirantes.length
        ? [['Atenção', `Exportados ${dadosFeirantes.length} de ${total} registros (limite de ${EXPORTACAO_MAX_REGISTROS})`]]
        : []),
    ];

    let reqBody = {
      nome: `financeiro_feira_${exportarTudo ? 'tudo' : `pagina${paginacaoFeira.pagina}`}_${dataExtracaoTitulo}`,
      tipo: `${tipoRelatorio} - ${dataExtracaoLabel}`,
      formato: 'xlsx' as const,
      aba: 'Resumo',
      data: dataResumo,
      abas: [
        { nome: 'Resumo', data: dataResumo },
        { nome: 'Transacoes', data: [] as Array<Array<string | number>> },
      ],
    };

    let linhaTitulo = [
      'Feira ID',
      'Feira titulo',
      'Feira data hora',
      'Feirante evento ID',
      'Feirante perfil ID',
      'Nome banca',
      'Nome responsavel',
      'Email responsavel',
      'Celular responsavel',
      'CPF responsavel',
      'RG responsavel',
      'Caixa aberto',
      'Status caixa',
      'Qtd no PIX',
      'R$ no PIX',
      'Qtd no Dinheiro',
      'R$ no Dinheiro',
      'Qtd no Credito',
      'R$ no Credito',
      'Qtd no Credito Parcelado',
      'R$ no Credito Parcelado',
      'Qtd em Negociacao',
      'R$ em Negociacao',
      'Qtd total',
      'R$ total',
      'R$ Arrecadacao',
      'R$ Lucro',
      'R$ na Banca',
      'R$ no CHAVE',
      'R$ Balancete',
      'Resumo Balancete',
      'Banco',
      'Agencia',
      'Conta',
      'CHAVE PIX',
      'Operacao ID',
      'Operacao tipo',
      'Operacao finalidade',
      'Operacao forma pagamento',
      'Operacao valor',
      'Operacao criado em',
      'Operacao criada por ID',
      'Operacao criada por nome',
      'Operacao descricao',
      'Operacao produto',
      'Operacao cliente',
      'Operacao observacao',
    ];

    reqBody.abas[1].data.push(linhaTitulo);

    for (let feirante of dadosFeirantes) {
      let caixa = calcularCaixaFeirante(feirante);
      const operacoes = feirante.Operacao.length ? feirante.Operacao : [null];
      const totalCreditoParcelado = feirante.Operacao.filter(
        (operacao: OperacaoFeiraResumo) => operacao.forma_pagamento === 'CREDITO_PARCELADO'
      );
      const totalNegociacao = feirante.Operacao.filter(
        (operacao: OperacaoFeiraResumo) => operacao.forma_pagamento === 'NEGOCIACAO'
      );
      const somaCreditoParcelado = totalCreditoParcelado.reduce(
        (total: number, operacao: OperacaoFeiraResumo) => total + parseMonetaryNumber(operacao.valor),
        0
      );
      const somaNegociacao = totalNegociacao.reduce(
        (total: number, operacao: OperacaoFeiraResumo) => total + parseMonetaryNumber(operacao.valor),
        0
      );

      for (const operacao of operacoes) {
        const linha = [
          feirante.eventoId,
          feirante.evento?.titulo ?? feiraSelecionada?.titulo ?? '',
          feirante.evento?.data_hora
            ? new Date(feirante.evento.data_hora).toLocaleString('pt-BR')
            : '',
          feirante.id,
          feirante.perfilId,
          feirante.perfil.nome_banca || '',
          `${feirante.perfil.nome} ${feirante.perfil.sobrenome}`,
          feirante.perfil.email ?? '',
          feirante.perfil.celular ?? '',
          feirante.perfil.cpf ?? '',
          feirante.perfil.rg ?? '',
          feirante.caixa_aberto ? 'SIM' : 'NAO',
          feirante.statusCaixa,
          caixa?.totalVendidoPorTipo['PIX'].qtd,
          formatarColunaDeValor(caixa?.totalVendidoPorTipo['PIX'].valor),
          caixa?.totalVendidoPorTipo['DINHEIRO'].qtd,
          formatarColunaDeValor(caixa?.totalVendidoPorTipo['DINHEIRO'].valor),
          caixa?.totalVendidoPorTipo['CREDITO'].qtd,
          formatarColunaDeValor(caixa?.totalVendidoPorTipo['CREDITO'].valor),
          totalCreditoParcelado.length,
          formatarColunaDeValor(somaCreditoParcelado),
          totalNegociacao.length,
          formatarColunaDeValor(somaNegociacao),
          feirante.Operacao.length || 0,
          formatarColunaDeValor(feirante.valorVendas),
          formatarColunaDeValor(caixa?.totalArrecadacao),
          formatarColunaDeValor(caixa?.totalLucro),
          formatarColunaDeValor(caixa?.saldoNoFeirante),
          formatarColunaDeValor(caixa?.saldoNoChave),
          formatarColunaDeValor(caixa?.balancete.resultado),
          caixa?.balancete.texto,
          feirante.pagamento_banco,
          feirante.pagamento_agencia,
          feirante.pagamento_conta,
          feirante.pagamento_chave_pix,
          operacao?.id ?? '',
          operacao?.tipo ?? '',
          operacao?.finalidade ?? '',
          operacao?.forma_pagamento ?? '',
          operacao?.valor ? formatarColunaDeValor(parseMonetaryNumber(operacao.valor)) : '',
          operacao?.criado_em ? new Date(operacao.criado_em).toLocaleString('pt-BR') : '',
          operacao?.criado_por ?? '',
          operacao?.criado_por_perfil
            ? `${operacao.criado_por_perfil.nome} ${operacao.criado_por_perfil.sobrenome}`
            : '',
          operacao?.descricao ?? '',
          operacao?.produto ?? '',
          operacao?.nome_cliente ?? '',
          operacao?.observacao ?? '',
        ];

        reqBody.abas[1].data.push(linha);
      }
    }

    return reqBody;
  }

  function montarUrlGeral(params: Record<string, string | number>) {
    const search = new URLSearchParams({
      feiraId: filtros.feiraId,
      nome: filtros.nome,
      statusCaixa: filtros.statusCaixa,
      ordenarPorFeira: filtros.ordenarPorFeira,
      direcaoFeira: filtros.direcaoFeira,
      paginaFeira: filtros.paginaFeira,
      porPaginaFeira: filtros.porPaginaFeira,
      ordenarPorGeral: filtros.ordenarPorGeral,
      direcaoGeral: filtros.direcaoGeral,
      paginaGeral: filtros.paginaGeral,
      porPaginaGeral: filtros.porPaginaGeral,
    });

    Object.entries(params).forEach(([chave, valor]) => {
      search.set(chave, String(valor));
    });

    return `/financeiro?${search.toString()}`;
  }

  function montarUrlFeira(params: Record<string, string | number>) {
    return montarUrlGeral(params);
  }

  return (
    <main>
      <Minicards cards={minicardsData} role='MINICARDS_FINANCEIRO' />

      <div className='view_container'>
        <div className='view'>
          <div className='view-header'>
            <h1>Financeiro geral</h1>
            <div className='view-header-actions'>
              <BotaoExportarRelatorio
                label='Exportar geral (resumo + operações)'
                gerarPayload={gerarPayloadRelatorioGeral}
                disabled={!operacoes.length}
                comOpcoes={true}
              />
              <Link to={'/financeiro/novo'}>+ Operação</Link>
            </div>
          </div>

          <OrdenacaoListagem
            ordenarPor={filtros.ordenarPorGeral}
            direcao={filtros.direcaoGeral}
            porPagina={filtros.porPaginaGeral}
            params={{
              ordenarPor: 'ordenarPorGeral',
              direcao: 'direcaoGeral',
              porPagina: 'porPaginaGeral',
              pagina: 'paginaGeral',
            }}
            opcoes={[
              { value: 'criado_em', label: 'Criado em' },
              { value: 'valor', label: 'Valor' },
              { value: 'tipo', label: 'Tipo' },
              { value: 'finalidade', label: 'Finalidade' },
              { value: 'id', label: 'ID' },
            ]}
          />

          <div className='view-body'>
            <table>
              <thead>
                <tr>
                  <td style={{ width: '50px' }}>#</td>
                  <td>Descrição</td>
                  <td>Tipo</td>
                  <td>Finalidade</td>
                  <td style={{ whiteSpace: 'nowrap' }}>Valor</td>
                  <td style={{ whiteSpace: 'nowrap' }}>Data</td>
                  <td style={{ width: '60px' }}></td>
                </tr>
              </thead>
              <tbody>
                {operacoes.length === 0 && (
                  <tr>
                    <td style={{ textAlign: 'center', padding: '2em', color: '#667085' }} colSpan={7}>
                      Nenhum resultado encontrado
                    </td>
                  </tr>
                )}
                {operacoes.map((operacao) => {
                  const descricao =
                    operacao.finalidade === 'FEIRA'
                      ? gerarDescricaoOperacaoFeira(operacao)
                      : operacao.descricao;

                  return (
                    <tr key={operacao.id}>
                      <td style={{ color: '#9aa5b4', fontSize: '0.8rem' }}>
                        <Link to={`/financeiro/${operacao.id}`}>{operacao.id}</Link>
                      </td>
                      <td style={{ maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Link to={`/financeiro/${operacao.id}`}>{descricao || '—'}</Link>
                      </td>
                      <td>
                        {operacao.tipo === 'ENTRADA' ? (
                          <span className='badge badge-green'>Entrada</span>
                        ) : (
                          <span className='badge badge-red'>Saída</span>
                        )}
                      </td>
                      <td>
                        {operacao.finalidade === 'FEIRA' ? (
                          <span className='badge badge-amber'>Feira</span>
                        ) : operacao.finalidade === 'DOACAO' ? (
                          <span className='badge badge-purple'>Doação</span>
                        ) : (
                          <span className='badge badge-gray'>{operacao.finalidade}</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap', color: operacao.tipo === 'ENTRADA' ? '#027a48' : '#b42318' }}>
                        {parseMonetaryNumber(operacao.valor).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>
                      <td
                        title={format(new Date(operacao.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        style={{ color: '#667085', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                      >
                        {format(new Date(operacao.criado_em), 'dd/MM/yyyy', { locale: ptBR })}
                      </td>
                      <td>
                        <div id='actions'>
                          <Link to={`/financeiro/${operacao.id}`} title='Ver'>
                            <i className='lar la-eye'></i>
                          </Link>
                          <Link to={`/financeiro/${operacao.id}/editar`} title='Editar'>
                            <i className='las la-pen'></i>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className='view-footer table-pagination'>
            <span>
              Mostrando {operacoes.length} de {paginacaoGeral.total} registros
            </span>
            <div className='table-pagination-actions'>
              <Link
                to={montarUrlGeral({ paginaGeral: Math.max(1, paginacaoGeral.pagina - 1) })}
                aria-disabled={paginacaoGeral.pagina <= 1}
              >
                Anterior
              </Link>
              <strong>
                Pagina {paginacaoGeral.pagina} de {paginacaoGeral.totalPaginas}
              </strong>
              <Link
                to={montarUrlGeral({
                  paginaGeral: Math.min(paginacaoGeral.totalPaginas, paginacaoGeral.pagina + 1),
                })}
                aria-disabled={paginacaoGeral.pagina >= paginacaoGeral.totalPaginas}
              >
                Proxima
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Financeiro das feiras: Admin e Feirante */}
      <div className='view_container'>
        <div className='view'>
          <div className='view-header'>
            <h1>Financeiro feiras</h1>
            <div className='view-header-actions'>
              <BotaoExportarRelatorio
                label='Exportar feira (resumo + transações)'
                gerarPayload={gerarPayloadRelatorioFeira}
                disabled={!feirantes.length}
                comOpcoes={true}
              />
            </div>
          </div>

          <FiltroListagem
            pageParam='paginaFeira'
            values={filtros}
            fields={[
              {
                name: 'feiraId',
                emptyValue: '0',
                label: 'Feira',
                type: 'select',
                options: [
                  { value: '0', label: 'Selecionar feira' },
                  ...feiras.map((feira: FeiraOption) => ({
                    value: String(feira.id),
                    label: feira.titulo,
                  })),
                ],
              },
              {
                name: 'nome',
                label: 'Feirante ou banca',
                type: 'text',
                placeholder: 'Ex: Joao ou Banca Sol',
              },
              {
                name: 'statusCaixa',
                label: 'Status do caixa',
                type: 'select',
                options: [
                  { value: '', label: 'Todos' },
                  { value: 'ABERTO', label: 'Aberto' },
                  { value: 'FECHADO', label: 'Fechado' },
                ],
              },
            ]}
          />

          <OrdenacaoListagem
            ordenarPor={filtros.ordenarPorFeira}
            direcao={filtros.direcaoFeira}
            porPagina={filtros.porPaginaFeira}
            params={{
              ordenarPor: 'ordenarPorFeira',
              direcao: 'direcaoFeira',
              porPagina: 'porPaginaFeira',
              pagina: 'paginaFeira',
            }}
            opcoes={[
              { value: 'id', label: 'Cadastro no evento' },
              { value: 'nome', label: 'Responsável' },
              { value: 'nome_banca', label: 'Banca' },
              { value: 'caixa_aberto', label: 'Caixa' },
            ]}
          />

          <div className='view-body'>
            <table>
              <thead>
                <tr>
                  <td style={{ minWidth: '160px' }}>Banca</td>
                  <td style={{ minWidth: '140px' }}>Responsável</td>
                  <td>Status</td>
                  <td>Chave PIX</td>
                  <td style={{ textAlign: 'center' }}>Vendas</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Total vendido</td>
                  <td style={{ width: '50px' }}></td>
                </tr>
              </thead>
              <tbody>
                {feirantes.length === 0 && (
                  <tr>
                    <td style={{ textAlign: 'center', padding: '2em', color: '#667085' }} colSpan={7}>
                      Nenhum dado para mostrar
                    </td>
                  </tr>
                )}
                {feirantes.map((feirante: FeiranteResumo) => {
                  return (
                    <tr key={feirante.id}>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Link to={`/feira/${feirante.eventoId}/feirante/${feirante.perfilId}`} style={{ fontWeight: 600 }}>
                          {feirante.perfil.nome_banca || '—'}
                        </Link>
                      </td>
                      <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Link to={`/gente/${feirante.perfilId}`}>
                          {feirante.perfil.nome} {feirante.perfil.sobrenome}
                        </Link>
                      </td>
                      <td>
                        {feirante.caixa_aberto ? (
                          <span className='badge badge-green'>Aberto</span>
                        ) : (
                          <span className='badge badge-gray'>Fechado</span>
                        )}
                      </td>
                      <td style={{ color: '#475467', fontSize: '0.82rem' }}>
                        {feirante.pagamento_chave_pix || '—'}
                      </td>
                      <td style={{ textAlign: 'center', color: '#475467' }}>{feirante.Operacao.length}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: feirante.valorVendas > 0 ? '#027a48' : '#475467' }}>
                        {feirante.valorVendas.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>
                      <td>
                        <div id='actions'>
                          <Link to={`/feira/${feirante.eventoId}/feirante/${feirante.perfilId}`} title='Ver caixa'>
                            <i className="las la-search-dollar"></i>
                          </Link>

                          {
                            feirante.caixa_aberto && (<button onClick={() => fecharCaixaFeirante(feirante.eventoId, feirante.perfilId)} title="Fechar caixa">
                              <i className="las la-lock"></i>
                            </button>)
                          }

                          {
                            !feirante.caixa_aberto && (<button type='button' title="Caixa fechado" disabled>
                              <i className="las la-lock-open"></i>
                            </button>)
                          }
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className='view-footer table-pagination'>
            <span>
              Mostrando {feirantes.length} de {paginacaoFeira.total} registros
            </span>
            <div className='table-pagination-actions'>
              <Link
                to={montarUrlFeira({ paginaFeira: Math.max(1, paginacaoFeira.pagina - 1) })}
                aria-disabled={paginacaoFeira.pagina <= 1}
              >
                Anterior
              </Link>
              <strong>
                Pagina {paginacaoFeira.pagina} de {paginacaoFeira.totalPaginas}
              </strong>
              <Link
                to={montarUrlFeira({
                  paginaFeira: Math.min(paginacaoFeira.totalPaginas, paginacaoFeira.pagina + 1),
                })}
                aria-disabled={paginacaoFeira.pagina >= paginacaoFeira.totalPaginas}
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
