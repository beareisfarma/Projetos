// Interpretador de datas em português, determinístico e sem custo nenhum.
// É o caminho padrão: cobre as formas que a gente realmente usa para falar de
// prazo ("sexta às 14h", "amanhã de manhã", "dia 20", "daqui a 2 semanas").
// Só quando ele não encontra data é que a IA entra — e ela é opcional.
import { paraLocal, deLocalParaUTC, DIA_MS } from './tempo.js';

export const HORA_PADRAO = 18;  // "sexta" sem hora = até o fim do dia útil
const z = (n, c = 2) => String(n).padStart(c, '0');

// O \b do JavaScript é ASCII: depois de "ã", "ç" ou "é" ele não reconhece fim
// de palavra, e em português isso quebra quase tudo ("amanhã", "terça", "mês").
// Estas bordas usam classes Unicode e funcionam com acento.
const I = '(?<![\\p{L}\\p{N}])';   // início de palavra
const F = '(?![\\p{L}\\p{N}])';    // fim de palavra
const re = (fonte) => new RegExp(fonte, 'iu');

const DIAS_SEMANA = [
  'domingo|dom', 'segunda|seg', 'ter[çc]a|ter', 'quarta|qua',
  'quinta|qui', 'sexta|sex', 's[áa]bado|sab',
];

const MESES = [
  'janeiro|jan', 'fevereiro|fev', 'mar[çc]o|mar', 'abril|abr', 'maio|mai', 'junho|jun',
  'julho|jul', 'agosto|ago', 'setembro|set', 'outubro|out', 'novembro|nov', 'dezembro|dez',
];

// Ordem importa: "meia-noite" antes de "noite", "meio-dia" antes do resto.
const PERIODOS = [
  { re: re(`${I}meia[-\\s]?noite${F}`), hora: 0 },
  { re: re(`${I}meio[-\\s]?dia${F}`), hora: 12 },
  { re: re(`${I}(?:de|da|à|a|pela)s?\\s+manh[ãa]${F}`), hora: 9 },
  { re: re(`${I}(?:de|da|à|a)s?\\s+tarde${F}`), hora: 14 },
  { re: re(`${I}(?:de|da|à|a)s?\\s+noite${F}`), hora: 20 },
  { re: re(`${I}(?:fim|final)\\s+do\\s+dia${F}`), hora: 18 },
  { re: re(`${I}cedo${F}`), hora: 8 },
];

const RE_HORA = re(`(?:${I}[àa]s\\s+)?${I}([01]?\\d|2[0-3])\\s*(?:h|:|horas?)\\s*([0-5]\\d)?${F}`);
// O período dito DEPOIS de uma hora explícita: "8h da noite". Sem isto o "da
// noite" não era consumido nem aplicado — "8h da noite" virava 8 da manhã, que
// é o tipo de erro que faz perder o compromisso e ainda parece que funcionou.
const RE_PERIODO_APOS = /^[\s,]*(?:d[ao]|[àa]|pela)s?\s+(tarde|noite|manh[ãa]|madrugada)(?![\p{L}\p{N}])/iu;
const RE_HORA_PERIODO = re(`${I}[àa]s\\s+(\\d{1,2})\\s+(?:da|de|à)\\s+(tarde|noite|manh[ãa])${F}`);
const RE_DEPOIS_AMANHA = re(`${I}depois\\s+de\\s+amanh[ãa]${F}`);
const RE_AMANHA = re(`${I}amanh[ãa]${F}`);
const RE_HOJE = re(`${I}hoje${F}`);
const RE_BARRA = re(`${I}(?:dia\\s+)?(0?[1-9]|[12]\\d|3[01])\\/(0?[1-9]|1[0-2])(?:\\/(\\d{2,4}))?${F}`);
const RE_MES_EXTENSO = re(`${I}(?:dia\\s+)?(0?[1-9]|[12]\\d|3[01])\\s+de\\s+(${MESES.join('|')})${F}`);
const RE_DIA_N = re(`${I}dia\\s+(0?[1-9]|[12]\\d|3[01])${F}`);
const RE_DAQUI = re(`${I}(?:em|daqui\\s+a?|dentro\\s+de)\\s+(um|uma|dois|duas|tr[êe]s|\\d{1,3})\\s+(dias?|semanas?|m[êe]s|meses)${F}`);
const RE_SEMANA_QUE_VEM = re(`${I}(?:semana\\s+que\\s+vem|pr[óo]xima\\s+semana)${F}`);
const RE_MES_QUE_VEM = re(`${I}(?:m[êe]s\\s+que\\s+vem|pr[óo]ximo\\s+m[êe]s)${F}`);
const RE_DIAS_SEMANA = DIAS_SEMANA.map((nomes) =>
  re(`${I}(?:n[ao]\\s+)?(?:${nomes})(?:\\s*-?\\s*feira)?(\\s+que\\s+vem|\\s+pr[óo]xim[ao])?${F}`));

/** Marca um trecho como consumido, para que ele saia do título depois. */
function consumir(trechos, achado) {
  if (achado) trechos.push([achado.index, achado.index + achado[0].length]);
}

function acharHora(texto, trechos) {
  let m = RE_HORA_PERIODO.exec(texto);   // "às 8 da noite" antes de "da noite" sozinho
  if (m) {
    consumir(trechos, m);
    let hora = +m[1];
    if (/tarde|noite/i.test(m[2]) && hora < 12) hora += 12;
    if (/manh/i.test(m[2]) && hora === 12) hora = 0;
    return { hora, minuto: 0 };
  }
  if ((m = RE_HORA.exec(texto))) {
    consumir(trechos, m);
    let hora = +m[1];
    // "8h da noite" → 20h. O trecho do período também sai do título.
    const fim = m.index + m[0].length;
    const p = RE_PERIODO_APOS.exec(texto.slice(fim));
    if (p) {
      trechos.push([fim, fim + p[0].length]);
      const periodo = p[1].toLowerCase();
      if (/tarde|noite/.test(periodo) && hora < 12) hora += 12;
      // "12 da manhã" e "12 da madrugada" são meia-noite, não meio-dia.
      if (/manh|madrugada/.test(periodo) && hora === 12) hora = 0;
    }
    return { hora, minuto: m[2] ? +m[2] : 0 };
  }
  for (const periodo of PERIODOS) {
    if ((m = periodo.re.exec(texto))) { consumir(trechos, m); return { hora: periodo.hora, minuto: 0 }; }
  }
  return null;
}

const ehPassado = (alvo, hoje) =>
  alvo.ano !== hoje.ano ? alvo.ano < hoje.ano
    : alvo.mes !== hoje.mes ? alvo.mes < hoje.mes
      : alvo.dia < hoje.dia;

function acharData(texto, trechos, agora) {
  const hoje = paraLocal(agora);
  // Meio-dia como âncora: somar dias em UTC nunca escorrega de data.
  const ancora = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia, 12));
  const somarDias = (n) => {
    const d = new Date(ancora.getTime() + n * DIA_MS);
    return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
  };
  const somarMeses = (n) => {
    const d = new Date(ancora); d.setUTCMonth(d.getUTCMonth() + n);
    return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
  };

  let m;
  if ((m = RE_DEPOIS_AMANHA.exec(texto))) { consumir(trechos, m); return { ...somarDias(2), certeza: 'alta' }; }
  if ((m = RE_AMANHA.exec(texto))) { consumir(trechos, m); return { ...somarDias(1), certeza: 'alta' }; }
  if ((m = RE_HOJE.exec(texto))) { consumir(trechos, m); return { ...somarDias(0), certeza: 'alta' }; }

  if ((m = RE_BARRA.exec(texto))) {
    consumir(trechos, m);
    let ano = m[3] ? +m[3] : hoje.ano;
    if (ano < 100) ano += 2000;
    const alvo = { ano, mes: +m[2], dia: +m[1] };
    if (!m[3] && ehPassado(alvo, hoje)) alvo.ano += 1;  // data sem ano que passou = ano que vem
    return { ...alvo, certeza: 'alta' };
  }

  if ((m = RE_MES_EXTENSO.exec(texto))) {
    consumir(trechos, m);
    const mes = MESES.findIndex((nomes) => re(`^(?:${nomes})$`).test(m[2])) + 1;
    const alvo = { ano: hoje.ano, mes, dia: +m[1] };
    if (ehPassado(alvo, hoje)) alvo.ano += 1;
    return { ...alvo, certeza: 'alta' };
  }

  if ((m = RE_DIA_N.exec(texto))) {
    consumir(trechos, m);
    const alvo = { ano: hoje.ano, mes: hoje.mes, dia: +m[1] };
    if (+m[1] < hoje.dia) {                              // "dia 3" no dia 28 = mês que vem
      alvo.mes += 1;
      if (alvo.mes > 12) { alvo.mes = 1; alvo.ano += 1; }
    }
    return { ...alvo, certeza: 'alta' };
  }

  if ((m = RE_DAQUI.exec(texto))) {
    consumir(trechos, m);
    const numeros = { um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3 };
    const n = numeros[m[1].toLowerCase()] ?? +m[1];
    if (/dia/i.test(m[2])) return { ...somarDias(n), certeza: 'alta' };
    if (/semana/i.test(m[2])) return { ...somarDias(n * 7), certeza: 'alta' };
    return { ...somarMeses(n), certeza: 'alta' };
  }

  if ((m = RE_SEMANA_QUE_VEM.exec(texto))) {
    consumir(trechos, m);
    const ateSegunda = ((1 - ancora.getUTCDay() + 7) % 7) || 7;
    return { ...somarDias(ateSegunda), certeza: 'media' };  // sem dia definido: cai na segunda
  }
  if ((m = RE_MES_QUE_VEM.exec(texto))) {
    consumir(trechos, m);
    return { ...somarMeses(1), certeza: 'media' };
  }

  for (let i = 0; i < RE_DIAS_SEMANA.length; i++) {
    if ((m = RE_DIAS_SEMANA[i].exec(texto))) {
      consumir(trechos, m);
      // Sem "que vem", o próprio dia de hoje vale: quem diz "sexta" numa sexta
      // de manhã quase sempre quer dizer hoje.
      let delta = (i - ancora.getUTCDay() + 7) % 7;
      if (delta === 0 && m[1]) delta = 7;   // "hoje que vem" não existe

      // "sexta que vem" pode ser esta sexta ou a da semana seguinte. O erro não é
      // simétrico: adiantar o lembrete uma semana incomoda, atrasar faz perder o
      // prazo. Fica na data MAIS CEDO e marca confiança média para ela conferir.
      // `diaSemana` diz a quem chamou que dá para rolar uma semana se a hora
      // dita já passou — "terça às 14h" numa terça às 15h é a terça seguinte.
      return { ...somarDias(delta), certeza: m[1] ? 'media' : 'alta', fonte: 'diaSemana' };
    }
  }
  return null;
}

const PREFIXOS_LIXO = [
  /^(?:eu\s+)?n[ãa]o\s+posso\s+perder\s+(?:o\s+)?prazo\s+(?:d[oae]\s+)?/iu,
  /^(?:eu\s+)?n[ãa]o\s+posso\s+(?:me\s+)?esquecer\s+(?:d[oae]\s+)?/iu,
  /^(?:me\s+)?lembr\p{L}*\s+(?:de\s+|que\s+eu\s+)?/iu,
  /^(?:eu\s+)?(?:preciso|tenho\s+que|devo|quero)\s+(?:de\s+)?/iu,
  /^(?:o\s+)?prazo\s+(?:d[oae]\s+)?/iu,
];

function limparTitulo(original, trechos) {
  // Recorta de trás para a frente para não invalidar os índices seguintes.
  let texto = original;
  for (const [ini, fim] of [...trechos].sort((a, b) => b[0] - a[0])) {
    texto = texto.slice(0, ini) + ' ' + texto.slice(fim);
  }
  texto = texto.replace(/\s+/g, ' ').trim();
  for (const padrao of PREFIXOS_LIXO) texto = texto.replace(padrao, '');
  texto = texto
    .replace(/\s+/g, ' ')
    // Recortar a data do meio da frase deixa pontuação órfã: "Palestra, , da
    // manhã". Junta as vírgulas que sobraram numa só antes de aparar as pontas.
    .replace(/(?:\s*[,;]\s*){2,}/g, ', ')
    .replace(/^[\s,;.:\-–—]+|[\s,;.:\-–—]+$/g, '')
    // Preposição solta no fim, sobra de recortar a data logo depois dela:
    // "almoço com a Ana ao" (meio-dia), "reunião na" (sexta).
    .replace(/\s+(?:n[ao]s?|a?os?|em|at[ée]|para|pra|pro|d[eoa]s?|às|as)$/iu, '')
    .trim();
  if (!texto) return '';
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * @returns {null|{titulo, detalhes, prazo, horaExplicita, dataExplicita, confianca, observacao, motor}}
 *   null = nada reconhecido; quem chamou decide se aciona a IA.
 */
export function interpretarLocal(recado, agora = new Date()) {
  const original = String(recado || '').trim();
  if (!original) return null;
  const texto = original.toLowerCase();

  const trechos = [];
  const hora = acharHora(texto, trechos);
  const data = acharData(texto, trechos, agora);
  if (!data && !hora) return null;

  const alvo = data || paraLocal(agora);
  const h = hora ? hora.hora : HORA_PADRAO;
  const min = hora ? hora.minuto : 0;
  let prazo = deLocalParaUTC(`${z(alvo.ano, 4)}-${z(alvo.mes)}-${z(alvo.dia)}T${z(h)}:${z(min)}`);

  let observacao = '';
  let confianca = data ? data.certeza : 'media';

  // Só hora, sem dia: se esse horário de hoje já passou, é amanhã.
  if (!data && prazo.getTime() <= agora.getTime()) {
    prazo = new Date(prazo.getTime() + DIA_MS);
    observacao = 'Entendi como amanhã, já que esse horário de hoje passou.';
  }
  // Dia da semana pelo nome, com a hora já vencida: ela quer o da semana que
  // vem. Só vale para o nome solto — quem escreve "hoje" ou "dia 20" disse uma
  // data, e inventar outra em cima disso seria pior do que avisar que passou.
  if (data && data.fonte === 'diaSemana' && prazo.getTime() <= agora.getTime()) {
    prazo = new Date(prazo.getTime() + 7 * DIA_MS);
    confianca = 'alta';
    observacao = 'Esse dia já passou nesta semana — marquei o da semana que vem.';
  }
  if (prazo.getTime() <= agora.getTime()) {
    confianca = 'baixa';
    observacao = 'A data que entendi já passou — confira.';
  } else if (!hora && confianca === 'alta') {
    observacao = `Sem hora dita, usei ${z(HORA_PADRAO)}:00.`;
  }

  const titulo = limparTitulo(original, trechos);
  if (!titulo) return null;   // sobrou só a data: não dá para nomear o lembrete

  return {
    titulo: titulo.slice(0, 120),
    detalhes: '',
    prazo,
    horaExplicita: Boolean(hora),
    dataExplicita: Boolean(data),
    confianca,
    observacao,
    motor: 'local',
  };
}
