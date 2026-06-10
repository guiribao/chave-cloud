import { cortarDecimal, parseMonetaryNumber, substituirPontoDecimalPorVirtgula } from "./Number.util";

export function calcularCaixaFeirante(feirante) {
  let totalVendido = 0;
  let totalVendidoPorTipo = {
    PIX: { valor: 0, qtd: 0 },
    CREDITO: { valor: 0, qtd: 0 },
    DINHEIRO: { valor: 0, qtd: 0 },
  };

  let saldoNoFeirante = 0;
  let saldoNoChave = 0;

  let balanco = 0;
  let feedbackPrompt = 'Ainda não calculado';

  let totalLucro = 0;
  let totalArrecadacao = 0;

  if (feirante.Operacao) {
    feirante.Operacao.forEach((operacao) => {
      const valorOperacao = parseMonetaryNumber(operacao.valor);

      if (operacao.forma_pagamento == 'PIX') {
        totalVendidoPorTipo['PIX'].valor += valorOperacao;
        totalVendidoPorTipo['PIX'].qtd += 1
        saldoNoChave += valorOperacao;
      } else if (operacao.forma_pagamento == 'DINHEIRO') {
        totalVendidoPorTipo['DINHEIRO'].valor += valorOperacao;
        totalVendidoPorTipo['DINHEIRO'].qtd += 1
        saldoNoFeirante += valorOperacao;
      } else {
        totalVendidoPorTipo['CREDITO'].valor += valorOperacao;
        totalVendidoPorTipo['CREDITO'].qtd += 1
        saldoNoFeirante += valorOperacao;
      }

      totalVendido += valorOperacao;
      totalArrecadacao = (feirante.perfil.membro) ? totalVendido * .2 : totalVendido * .3;
      totalLucro = totalVendido - totalArrecadacao;
      balanco = totalVendido - saldoNoFeirante - totalArrecadacao;

      if (balanco == 0) {
        feedbackPrompt = `Tudo certinho, as contas bateram!`;
      } else if (balanco > 0) {
        // O CHAVE irá repassar pra você
        feedbackPrompt = `Saldo a receber do CHAVE: ${balanco.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })}`;
      } else {
        // Você deve repassar para o CHAVE
        feedbackPrompt = `Saldo a enviar para o CHAVE: ${balanco
          .toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })
          .replace('-', '')}`;
      }
    });

    return {
      totalVendido,
      totalArrecadacao,
      totalLucro,
      totalVendidoPorTipo,
      saldoNoFeirante,
      saldoNoChave,
      balancete: { resultado: balanco, texto: feedbackPrompt }
    }
  }
}

export function formatarColunaDeValor(valorOriginal) {
  let novoNumero = cortarDecimal(valorOriginal, 2)
  let n = substituirPontoDecimalPorVirtgula(novoNumero)

  return n
}