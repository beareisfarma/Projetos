/**
 * Dinheiro e datas.
 *
 * REGRA QUE NÃO SE QUEBRA: dinheiro circula em CENTAVOS INTEIROS o app inteiro.
 * Float em mensalidade dá 0,01 de diferença que ninguém acha depois, e aqui o
 * número vai para a conta de um negócio de verdade. Só vira texto na hora de
 * mostrar; só vira número na hora de somar.
 */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const reais = (centavos) => BRL.format((Number(centavos) || 0) / 100);

/** Mesmo valor, com sinal explícito — usado no extrato do caixa. */
export const reaisComSinal = (centavos) =>
  `${centavos < 0 ? '−' : '+'} ${BRL.format(Math.abs(Number(centavos) || 0) / 100)}`;

/**
 * Lê o que a pessoa digitou e devolve centavos.
 * Aceita "150", "150,50", "R$ 1.500,00" e "1500.50". A regra é a brasileira:
 * quando existem os dois separadores, a vírgula é o decimal e o ponto é
 * milhar; quando só existe ponto, ele só é decimal se sobrarem duas casas.
 */
export function emCentavos(entrada) {
  if (typeof entrada === 'number') return Math.round(entrada * 100);
  let texto = String(entrada || '').replace(/[^\d.,-]/g, '').trim();
  if (!texto) return 0;

  const negativo = texto.startsWith('-');
  texto = texto.replace(/-/g, '');

  const temVirgula = texto.includes(',');
  const temPonto = texto.includes('.');

  if (temVirgula && temPonto) texto = texto.replace(/\./g, '').replace(',', '.');
  else if (temVirgula) texto = texto.replace(',', '.');
  else if (temPonto && !/\.\d{2}$/.test(texto)) texto = texto.replace(/\./g, '');

  const valor = Number(texto);
  if (!Number.isFinite(valor)) return 0;
  return Math.round(valor * 100) * (negativo ? -1 : 1);
}

// ─── Datas ───────────────────────────────────────────────────────────────────
// Tudo em 'AAAA-MM-DD' montado à mão a partir da data LOCAL. `toISOString()`
// converte para UTC e, à noite no Brasil, devolve o dia seguinte — já foi
// motivo de mensalidade nascer vencendo um dia errado.

export function diaLocal(data = new Date()) {
  const d = data instanceof Date ? data : new Date(data);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const hoje = () => diaLocal(new Date());

/** 'AAAA-MM' do mês de referência (a "competência" da mensalidade). */
export const competenciaDe = (dia) => String(dia || hoje()).slice(0, 7);
export const competenciaAtual = () => competenciaDe(hoje());

export function somarMeses(competencia, meses) {
  const [ano, mes] = String(competencia).split('-').map(Number);
  const total = ano * 12 + (mes - 1) + meses;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

const ultimoDiaDoMes = (ano, mes) => new Date(ano, mes, 0).getDate();

/**
 * Data de vencimento de uma competência.
 * Dia 31 num mês de 30 (ou fevereiro) cai para o último dia do mês, em vez de
 * escorregar para o mês seguinte — que é o que `new Date(ano, mes, 31)` faria.
 */
export function vencimentoEm(competencia, dia) {
  const [ano, mes] = String(competencia).split('-').map(Number);
  const escolhido = Math.min(Math.max(Number(dia) || 10, 1), 31);
  return `${competencia}-${String(Math.min(escolhido, ultimoDiaDoMes(ano, mes))).padStart(2, '0')}`;
}

/** Diferença em dias entre duas datas 'AAAA-MM-DD', pelo calendário. */
export function diasEntre(de, ate) {
  const [a1, m1, d1] = String(de).split('-').map(Number);
  const [a2, m2, d2] = String(ate).split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

export const dataBR = (dia) => {
  const [ano, mes, d] = String(dia || '').split('-');
  return ano ? `${d}/${mes}/${ano}` : '';
};

/** '18/09' — para listas, onde o ano é ruído. */
export const dataCurta = (dia) => dataBR(dia).slice(0, 5);

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function competenciaPorExtenso(competencia) {
  const [ano, mes] = String(competencia || '').split('-').map(Number);
  return MESES[mes - 1] ? `${MESES[mes - 1]} de ${ano}` : '';
}

/** 'set/26' — cabeçalho de coluna, onde não cabe o nome inteiro. */
export function competenciaCurta(competencia) {
  const [ano, mes] = String(competencia || '').split('-').map(Number);
  return MESES[mes - 1] ? `${MESES[mes - 1].slice(0, 3)}/${String(ano).slice(2)}` : '';
}

const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function diaDaSemana(dia) {
  const [ano, mes, d] = String(dia || '').split('-').map(Number);
  return ano ? SEMANA[new Date(ano, mes - 1, d).getDay()] : '';
}

/** Idade em anos completos — usada para saber se o atleta é menor de idade. */
export function idade(nascimento, referencia = hoje()) {
  if (!nascimento) return null;
  const dias = diasEntre(nascimento, referencia);
  if (dias < 0) return null;
  const [an, mn, dn] = nascimento.split('-').map(Number);
  const [ar, mr, dr] = referencia.split('-').map(Number);
  let anos = ar - an;
  if (mr < mn || (mr === mn && dr < dn)) anos -= 1;
  return anos;
}

/** Telefone só com dígitos, no formato que o WhatsApp espera (55 + DDD + número). */
export function telefoneInternacional(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '');
  if (digitos.length < 10) return '';
  return digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`;
}

export function telefoneBonito(telefone) {
  const d = String(telefone || '').replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(telefone || '');
}
