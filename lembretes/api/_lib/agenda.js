// A escada de avisos. Um lembrete único sempre chega na hora errada: ou cedo
// demais para agir, ou tarde demais para salvar. Por isso cada prazo gera vários
// avisos, que ficam mais frequentes conforme ele se aproxima.
import { DIA_MS, HORA_MS, naMesmaDataLocal } from './tempo.js';

export const ESCADA = [
  { chave: 'd7',   diasAntes: 7, horaLocal: 9, rotulo: 'Falta 1 semana' },
  { chave: 'd3',   diasAntes: 3, horaLocal: 9, rotulo: 'Faltam 3 dias' },
  { chave: 'd1',   diasAntes: 1, horaLocal: 9, rotulo: 'É amanhã' },
  { chave: 'dia',  diasAntes: 0, horaLocal: 8, rotulo: 'É hoje' },
  { chave: 'h3',   antesMs: 3 * HORA_MS,       rotulo: 'Faltam 3 horas' },
  { chave: 'm30',  antesMs: 30 * 60000,        rotulo: 'Faltam 30 minutos' },
  { chave: 'prazo', antesMs: 0,                rotulo: 'O prazo é agora' },
];

/**
 * Monta os avisos de um prazo, descartando os que já passaram.
 *
 * Regras que importam:
 * - avisos no passado são inúteis (não se notifica ontem);
 * - avisos depois do prazo também, exceto o do próprio prazo;
 * - se nada sobrar (prazo criado em cima da hora), avisa na hora do prazo,
 *   para que nenhum lembrete nasça mudo.
 */
export function montarAvisos(prazoMs, agoraMs = Date.now()) {
  const prazo = new Date(prazoMs);
  const vistos = new Set();
  const avisos = [];

  for (const degrau of ESCADA) {
    const quando = degrau.antesMs !== undefined
      ? prazoMs - degrau.antesMs
      : naMesmaDataLocal(new Date(prazoMs - degrau.diasAntes * DIA_MS), degrau.horaLocal).getTime();

    if (quando <= agoraMs) continue;        // já passou
    if (quando > prazoMs) continue;         // depois do prazo não serve
    if (vistos.has(quando)) continue;       // dois degraus caíram no mesmo instante
    vistos.add(quando);
    avisos.push({ chave: degrau.chave, em: new Date(quando).toISOString(), rotulo: degrau.rotulo });
  }

  if (avisos.length === 0) {
    const quando = Math.max(prazoMs, agoraMs + 60000);
    avisos.push({ chave: 'prazo', em: new Date(quando).toISOString(), rotulo: 'O prazo é agora' });
  }

  avisos.sort((a, b) => Date.parse(a.em) - Date.parse(b.em));
  return avisos;
}

/** Texto relativo em pt-BR: "em 2 dias", "atrasado há 3 horas". */
export function comoFalta(prazoMs, agoraMs = Date.now()) {
  const delta = prazoMs - agoraMs;
  const atrasado = delta < 0;
  const abs = Math.abs(delta);
  const min = Math.round(abs / 60000);

  let medida;
  if (min < 1) medida = 'menos de 1 minuto';
  else if (min < 60) medida = `${min} ${min === 1 ? 'minuto' : 'minutos'}`;
  else if (abs < DIA_MS) {
    const h = Math.round(abs / HORA_MS);
    medida = `${h} ${h === 1 ? 'hora' : 'horas'}`;
  } else {
    const d = Math.round(abs / DIA_MS);
    medida = `${d} ${d === 1 ? 'dia' : 'dias'}`;
  }
  return atrasado ? `atrasado há ${medida}` : `em ${medida}`;
}

/** Faixa usada para agrupar a lista de pendentes na tela. */
export function faixa(prazoMs, agoraMs = Date.now()) {
  if (prazoMs < agoraMs) return 'atrasado';
  const fimDeHoje = naMesmaDataLocal(new Date(agoraMs), 23, 59).getTime();
  if (prazoMs <= fimDeHoje) return 'hoje';
  if (prazoMs <= fimDeHoje + DIA_MS) return 'amanha';
  if (prazoMs <= fimDeHoje + 7 * DIA_MS) return 'semana';
  return 'depois';
}
