export function gerarDescricaoOperacaoFeira(operacao) {
  let nomeBarraca =
    operacao.feirante?.perfil?.nome_banca ||
    `${operacao.feirante?.perfil.nome} ${operacao.feirante?.perfil.sobrenome}`;
  return `${operacao.evento?.titulo} - venda de ${nomeBarraca}`;
}