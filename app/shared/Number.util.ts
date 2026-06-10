
export function cortarDecimal(numero, casas) {
  var re = new RegExp('^-?\\d+(?:\.\\d{0,' + (casas || -1) + '})?');
  return numero.toString().match(re)[0];
}

export function substituirPontoDecimalPorVirtgula(aStringNumber) {
  return aStringNumber.replaceAll(".", ",")
}

export function parseMonetaryNumber(valor: unknown) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  if (typeof valor === 'bigint') return Number(valor);
  if (valor === null || valor === undefined) return 0;

  const bruto = String(valor).trim();
  if (!bruto) return 0;

  const normalizado = bruto
    .replace(/\s/g, '')
    .replace('R$', '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');

  const numero = Number.parseFloat(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}