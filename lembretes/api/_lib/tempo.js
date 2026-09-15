// Conversões entre o relógio de parede da Beatriz (America/Sao_Paulo) e instantes
// UTC. O Brasil não usa mais horário de verão desde 2019, mas em vez de fixar
// -03:00 o offset é lido do próprio ICU a cada instante — se o horário de verão
// voltar, isto continua correto sem alterar código.
export const FUSO = process.env.FUSO_HORARIO || 'America/Sao_Paulo';

const CAMPOS = {
  hour12: false,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
};

function partes(data, fuso) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: fuso, ...CAMPOS });
  const p = {};
  for (const { type, value } of fmt.formatToParts(data)) p[type] = value;
  // Em hour12:false o ICU devolve 24 para a meia-noite; normaliza para 0.
  return {
    ano: +p.year, mes: +p.month, dia: +p.day,
    hora: +p.hour % 24, minuto: +p.minute, segundo: +p.second,
  };
}

/** Minutos que o fuso está à frente do UTC no instante dado (-180 em São Paulo). */
export function offsetMinutos(data, fuso = FUSO) {
  const p = partes(data, fuso);
  const comoSeFosseUTC = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return (comoSeFosseUTC - Math.floor(data.getTime() / 1000) * 1000) / 60000;
}

/**
 * "2026-09-19T14:00" no fuso local -> instante UTC.
 * Resolve em duas passadas porque o offset depende do próprio instante que
 * estamos calculando (importa apenas se o horário de verão voltar).
 */
export function deLocalParaUTC(textoLocal, fuso = FUSO) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(textoLocal).trim());
  if (!m) throw new Error(`Data local inválida: ${textoLocal}`);
  const [, ano, mes, dia, hora, minuto, segundo] = m.map(Number);
  const ingenuo = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo || 0);
  let instante = new Date(ingenuo);
  for (let i = 0; i < 2; i++) {
    instante = new Date(ingenuo - offsetMinutos(instante, fuso) * 60000);
  }
  return instante;
}

/** Instante UTC -> {ano, mes, dia, hora, minuto} no fuso local. */
export function paraLocal(data, fuso = FUSO) {
  return partes(data instanceof Date ? data : new Date(data), fuso);
}

/** "2026-09-19T14:00" — o formato que o interpretador devolve e consome. */
export function textoLocal(data, fuso = FUSO) {
  const p = paraLocal(data, fuso);
  const z = (n, c = 2) => String(n).padStart(c, '0');
  return `${z(p.ano, 4)}-${z(p.mes)}-${z(p.dia)}T${z(p.hora)}:${z(p.minuto)}`;
}

/** Mesma data local (dia/mês/ano) definida a uma hora específica, em UTC. */
export function naMesmaDataLocal(instante, hora, minuto = 0, fuso = FUSO) {
  const p = paraLocal(instante, fuso);
  const z = (n, c = 2) => String(n).padStart(c, '0');
  return deLocalParaUTC(`${z(p.ano, 4)}-${z(p.mes)}-${z(p.dia)}T${z(hora)}:${z(minuto)}`, fuso);
}

export const DIA_MS = 86400000;
export const HORA_MS = 3600000;
