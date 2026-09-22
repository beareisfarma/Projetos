/*
 * Funções de apoio: normalização de texto, datas e reconhecimento de dia/turno.
 * Ficam separadas porque o importador e a tela usam as mesmas regras — se a
 * tela entende "Terça" e o importador escreve "TERCA", a lista vem vazia.
 */

export const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
export const TURNOS = ["Manhã", "Tarde"];

export function semAcento(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// A pontuação dos nomes não pode atrapalhar quem digita com pressa:
// "Sant'anna" precisa aparecer buscando "sant anna" e também "santanna".
export function chaveBusca(texto) {
  return semAcento(texto)
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function casa(alvo, procurado) {
  if (!procurado) return true;
  if (!alvo) return false;
  return alvo.includes(procurado) || alvo.replace(/ /g, "").includes(procurado.replace(/ /g, ""));
}

export function esc(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function agrupar(itens, chave) {
  return itens.reduce((acumulado, item) => {
    const k = chave(item);
    (acumulado[k] ??= []).push(item);
    return acumulado;
  }, {});
}

export function hojeISO() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

export function dataCurta(iso) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return partes ? `${partes[3]}/${partes[2]}` : "";
}

export function dataLonga(iso) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : "";
}

export function diaDeHoje() {
  // Fim de semana cai em Segunda, que é onde o planejamento começa.
  const mapa = { 1: "Segunda", 2: "Terça", 3: "Quarta", 4: "Quinta", 5: "Sexta" };
  return mapa[new Date().getDay()] || "Segunda";
}

/* ---------------------------------------------------- leitura de dia e turno */

// A planilha de cada pessoa escreve o dia como der na telha: "SEGUNDA-FEIRA",
// "seg", "2ª feira", "Monday", o número 2. Tudo isso vira "Segunda" ou nada.
const APELIDOS_DIA = [
  [/^(2|2a|2ª|seg|segunda|segundafeira|monday|mon)$/, "Segunda"],
  [/^(3|3a|3ª|ter|terca|tercafeira|tuesday|tue)$/, "Terça"],
  [/^(4|4a|4ª|qua|quarta|quartafeira|wednesday|wed)$/, "Quarta"],
  [/^(5|5a|5ª|qui|quinta|quintafeira|thursday|thu)$/, "Quinta"],
  [/^(6|6a|6ª|sex|sexta|sextafeira|friday|fri)$/, "Sexta"],
];

export function lerDia(valor) {
  const limpo = semAcento(valor).replace(/[^a-z0-9ª]/g, "");
  if (!limpo) return null;
  for (const [padrao, dia] of APELIDOS_DIA) if (padrao.test(limpo)) return dia;
  // Última tentativa: o nome do dia embutido num texto maior.
  for (const dia of DIAS) if (limpo.includes(semAcento(dia))) return dia;
  return null;
}

export function lerTurno(valor) {
  const limpo = semAcento(valor).replace(/[^a-z]/g, "");
  if (!limpo) return null;
  if (/^(m|manha|manhas|matutino|am|morning)$/.test(limpo)) return "Manhã";
  if (/^(t|tarde|tardes|vespertino|pm|afternoon)$/.test(limpo)) return "Tarde";
  if (limpo.includes("manha") || limpo.includes("matutino")) return "Manhã";
  if (limpo.includes("tarde") || limpo.includes("vespertino")) return "Tarde";
  return null;
}

// Aceita "8", "8h", "08:00", "8:5", "0,354166" (hora serial do Excel) e devolve
// sempre "HH:MM" — ou null, que é como o importador sabe que a linha não serve.
export function lerHora(valor) {
  if (valor == null || valor === "") return null;

  if (typeof valor === "number" && Number.isFinite(valor)) {
    // O Excel guarda hora como fração de um dia. Acima de 1 é data+hora.
    const fracao = valor % 1;
    const minutosTotais = Math.round(fracao * 24 * 60);
    if (minutosTotais < 0 || minutosTotais > 24 * 60) return null;
    const h = Math.floor(minutosTotais / 60) % 24;
    const m = minutosTotais % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  const texto = String(valor).trim();
  const comSeparador = /^(\d{1,2})\s*[:h.,]\s*(\d{1,2})/.exec(texto);
  if (comSeparador) {
    const h = Number(comSeparador[1]);
    const m = Number(comSeparador[2]);
    if (h > 23 || m > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  const soHora = /^(\d{1,2})\s*h?$/i.exec(texto);
  if (soHora) {
    const h = Number(soHora[1]);
    if (h > 23) return null;
    return `${String(h).padStart(2, "0")}:00`;
  }

  return null;
}

// Sem coluna de turno, quem decide é o horário de início: é a convenção do
// próprio documento da Beatriz (manhã termina ao meio-dia).
export function turnoPelaHora(hora) {
  const partes = /^(\d{2}):(\d{2})$/.exec(hora || "");
  if (!partes) return null;
  return Number(partes[1]) < 12 ? "Manhã" : "Tarde";
}

export function texto(valor) {
  if (valor == null) return "";
  return String(valor).replace(/\s+/g, " ").trim();
}

// "1", "2", "1 visita", "duas" → 1 ou 2. Qualquer outra coisa vira 1.
export function lerAlvo(valor) {
  const limpo = semAcento(valor);
  if (!limpo) return 1;
  if (/\b2\b|dois|duas|dupla|quinzenal/.test(limpo)) return 2;
  return 1;
}
