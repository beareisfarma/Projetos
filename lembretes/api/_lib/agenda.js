// Quando avisar. Cada lembrete sempre avisa no momento exato do prazo, e a
// Beatriz escolhe quantas antecedências quer além disso.
import { DIA_MS, HORA_MS, naMesmaDataLocal } from './tempo.js';

/** As opções oferecidas na tela, da mais distante para a mais próxima. */
export const ANTECEDENCIAS = [
  { chave: 'd2',  minutos: 2 * 1440, rotulo: '2 dias antes',     curto: '2 dias' },
  { chave: 'd1',  minutos: 1440,     rotulo: '1 dia antes',      curto: '1 dia' },
  { chave: 'h1',  minutos: 60,       rotulo: '1 hora antes',     curto: '1 hora' },
  { chave: 'm15', minutos: 15,       rotulo: '15 minutos antes', curto: '15 min' },
  { chave: 'm5',  minutos: 5,        rotulo: '5 minutos antes',  curto: '5 min' },
];

// Um dia antes para se preparar, uma hora antes para agir.
export const ANTECEDENCIAS_PADRAO = ['d1', 'h1'];

const PORCHAVE = new Map(ANTECEDENCIAS.map((a) => [a.chave, a]));

/** Só as chaves conhecidas, sem repetição, na ordem canônica. */
export function normalizarAntecedencias(chaves) {
  if (!Array.isArray(chaves)) return [...ANTECEDENCIAS_PADRAO];
  const escolhidas = new Set(chaves.filter((c) => PORCHAVE.has(c)));
  return ANTECEDENCIAS.filter((a) => escolhidas.has(a.chave)).map((a) => a.chave);
}

export const rotuloAntecedencia = (chave) =>
  chave === 'prazo' ? 'Na hora do prazo'
    : chave === 'atraso' ? 'Passou do prazo'
      : PORCHAVE.get(chave)?.rotulo || chave;

/**
 * Monta os avisos de um prazo.
 *
 * Regras que importam:
 * - o aviso do momento exato existe sempre, escolha o que escolher;
 * - aviso no passado é inútil (não se notifica ontem), então é descartado;
 * - se tudo cair no passado, avisa na hora do prazo — nenhum lembrete nasce mudo.
 */
export function montarAvisos(prazoMs, agoraMs = Date.now(), antecedencias = ANTECEDENCIAS_PADRAO) {
  const escolhidas = normalizarAntecedencias(antecedencias);
  const avisos = [];
  const vistos = new Set();

  for (const chave of escolhidas) {
    const quando = prazoMs - PORCHAVE.get(chave).minutos * 60000;
    if (quando <= agoraMs || vistos.has(quando)) continue;
    vistos.add(quando);
    avisos.push({ chave, em: new Date(quando).toISOString(), rotulo: rotuloAntecedencia(chave) });
  }

  if (prazoMs > agoraMs && !vistos.has(prazoMs)) {
    avisos.push({ chave: 'prazo', em: new Date(prazoMs).toISOString(), rotulo: 'O prazo é agora' });
  }

  if (avisos.length === 0) {
    // Prazo criado em cima da hora, ou já vencido: avisa mesmo assim.
    const quando = Math.max(prazoMs, agoraMs + 60000);
    avisos.push({ chave: 'prazo', em: new Date(quando).toISOString(), rotulo: 'O prazo é agora' });
  }

  avisos.sort((a, b) => Date.parse(a.em) - Date.parse(b.em));
  return avisos;
}

/** Texto relativo em pt-BR: "em 2 dias", "atrasado há 3 horas". */
/**
 * Próximo aviso diário de atraso, ou null se o prazo ainda não passou.
 *
 * Repete no MESMO horário do prazo, um dia depois do outro: "o prazo era 14h de
 * segunda" vira "em atraso há 1 dia" às 14h de terça. Assim o número de dias é
 * exato, e não um arredondamento de um horário fixo qualquer.
 *
 * A conta usa o próximo múltiplo de 24h ainda no futuro, não "ontem + 1": se o
 * tick ficou parado dois dias, o aviso que volta é o do dia certo, sem disparar
 * a fila inteira de uma vez.
 */
export function avisoDeAtraso(prazoMs, agoraMs = Date.now()) {
  if (!Number.isFinite(prazoMs) || agoraMs < prazoMs) return null;
  const dias = Math.floor((agoraMs - prazoMs) / DIA_MS) + 1;
  return {
    chave: `atraso-d${dias}`,
    em: new Date(prazoMs + dias * DIA_MS).toISOString(),
    rotulo: dias === 1 ? 'Em atraso há 1 dia' : `Em atraso há ${dias} dias`,
  };
}

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

const fimDoDiaLocal = (ms) => naMesmaDataLocal(new Date(ms), 23, 59).getTime();

/** Faixa usada para agrupar e contar na tela. */
export function faixa(prazoMs, agoraMs = Date.now()) {
  if (prazoMs < agoraMs) return 'atrasado';
  const fimDeHoje = fimDoDiaLocal(agoraMs);
  if (prazoMs <= fimDeHoje) return 'hoje';
  if (prazoMs <= fimDeHoje + DIA_MS) return 'amanha';
  if (prazoMs <= fimDeHoje + 7 * DIA_MS) return 'semana';
  return 'depois';
}
