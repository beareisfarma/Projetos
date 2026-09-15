// GERADO por scripts/montar-funcao.mjs — não edite aqui.
// Edite os módulos em api/_lib/ e rode: npm run build:funcao
// O runtime das Edge Functions proíbe escrever em Deno.env — qualquer
// process.env.X = ... vira "The operation is not supported". Então este
// process é nosso: começa com o ambiente da plataforma e aceita a
// configuração vinda da tabela config_app por cima.
const process = { env: { ...Deno.env.toObject() } };
import { Buffer } from 'node:buffer';
import webpush from 'npm:web-push@3.6.7';

// Conversões entre o relógio de parede da Beatriz (America/Sao_Paulo) e instantes
// UTC. O Brasil não usa mais horário de verão desde 2019, mas em vez de fixar
// -03:00 o offset é lido do próprio ICU a cada instante — se o horário de verão
// voltar, isto continua correto sem alterar código.
const FUSO = process.env.FUSO_HORARIO || 'America/Sao_Paulo';

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
function offsetMinutos(data, fuso = FUSO) {
  const p = partes(data, fuso);
  const comoSeFosseUTC = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return (comoSeFosseUTC - Math.floor(data.getTime() / 1000) * 1000) / 60000;
}

/**
 * "2026-09-19T14:00" no fuso local -> instante UTC.
 * Resolve em duas passadas porque o offset depende do próprio instante que
 * estamos calculando (importa apenas se o horário de verão voltar).
 */
function deLocalParaUTC(textoLocal, fuso = FUSO) {
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
function paraLocal(data, fuso = FUSO) {
  return partes(data instanceof Date ? data : new Date(data), fuso);
}

/** "2026-09-19T14:00" — o formato que o interpretador devolve e consome. */
function textoLocal(data, fuso = FUSO) {
  const p = paraLocal(data, fuso);
  const z = (n, c = 2) => String(n).padStart(c, '0');
  return `${z(p.ano, 4)}-${z(p.mes)}-${z(p.dia)}T${z(p.hora)}:${z(p.minuto)}`;
}

/** Mesma data local (dia/mês/ano) definida a uma hora específica, em UTC. */
function naMesmaDataLocal(instante, hora, minuto = 0, fuso = FUSO) {
  const p = paraLocal(instante, fuso);
  const z = (n, c = 2) => String(n).padStart(c, '0');
  return deLocalParaUTC(`${z(p.ano, 4)}-${z(p.mes)}-${z(p.dia)}T${z(hora)}:${z(minuto)}`, fuso);
}

const DIA_MS = 86400000;
const HORA_MS = 3600000;

// Quando avisar. Cada lembrete sempre avisa no momento exato do prazo, e a
// Beatriz escolhe quantas antecedências quer além disso.


/** As opções oferecidas na tela, da mais distante para a mais próxima. */
const ANTECEDENCIAS = [
  { chave: 'd2',  minutos: 2 * 1440, rotulo: '2 dias antes',     curto: '2 dias' },
  { chave: 'd1',  minutos: 1440,     rotulo: '1 dia antes',      curto: '1 dia' },
  { chave: 'h1',  minutos: 60,       rotulo: '1 hora antes',     curto: '1 hora' },
  { chave: 'm15', minutos: 15,       rotulo: '15 minutos antes', curto: '15 min' },
  { chave: 'm5',  minutos: 5,        rotulo: '5 minutos antes',  curto: '5 min' },
];

// Um dia antes para se preparar, uma hora antes para agir.
const ANTECEDENCIAS_PADRAO = ['d1', 'h1'];

const PORCHAVE = new Map(ANTECEDENCIAS.map((a) => [a.chave, a]));

/** Só as chaves conhecidas, sem repetição, na ordem canônica. */
function normalizarAntecedencias(chaves) {
  if (!Array.isArray(chaves)) return [...ANTECEDENCIAS_PADRAO];
  const escolhidas = new Set(chaves.filter((c) => PORCHAVE.has(c)));
  return ANTECEDENCIAS.filter((a) => escolhidas.has(a.chave)).map((a) => a.chave);
}

const rotuloAntecedencia = (chave) =>
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
function montarAvisos(prazoMs, agoraMs = Date.now(), antecedencias = ANTECEDENCIAS_PADRAO) {
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
function comoFalta(prazoMs, agoraMs = Date.now()) {
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
function faixa(prazoMs, agoraMs = Date.now()) {
  if (prazoMs < agoraMs) return 'atrasado';
  const fimDeHoje = fimDoDiaLocal(agoraMs);
  if (prazoMs <= fimDeHoje) return 'hoje';
  if (prazoMs <= fimDeHoje + DIA_MS) return 'amanha';
  if (prazoMs <= fimDeHoje + 7 * DIA_MS) return 'semana';
  return 'depois';
}

// Interpretador de datas em português, determinístico e sem custo nenhum.
// É o caminho padrão: cobre as formas que a gente realmente usa para falar de
// prazo ("sexta às 14h", "amanhã de manhã", "dia 20", "daqui a 2 semanas").
// Só quando ele não encontra data é que a IA entra — e ela é opcional.


const HORA_PADRAO = 18;  // "sexta" sem hora = até o fim do dia útil
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
    return { hora: +m[1], minuto: m[2] ? +m[2] : 0 };
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
      return { ...somarDias(delta), certeza: m[1] ? 'media' : 'alta' };
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
    .replace(/^[\s,;.:\-–—]+|[\s,;.:\-–—]+$/g, '')
    .replace(/\s+(?:n[ao]|em|at[ée]|para|pra|pro|d[eoa]|às|as)$/iu, '')
    .trim();
  if (!texto) return '';
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * @returns {null|{titulo, detalhes, prazo, horaExplicita, confianca, observacao, motor}}
 *   null = nada reconhecido; quem chamou decide se aciona a IA.
 */
function interpretarLocal(recado, agora = new Date()) {
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
    confianca,
    observacao,
    motor: 'local',
  };
}

// Forma canônica de um lembrete e as transições que ele sofre.



function criarLembrete({ titulo, detalhes = '', prazo, origem = 'texto', confianca = 'alta', observacao = '', motor = 'manual', antecedencias = ANTECEDENCIAS_PADRAO, agora = new Date() }) {
  const escolhidas = normalizarAntecedencias(antecedencias);
  const prazoIso = (prazo instanceof Date ? prazo : new Date(prazo)).toISOString();
  return {
    id: novoId(),
    titulo,
    detalhes,
    prazo: prazoIso,
    status: 'pendente',
    origem,                 // 'texto' | 'audio'
    motor,                  // 'local' | 'ia' | 'palpite' | 'manual' — quem leu a data
    confianca,              // 'alta' | 'media' | 'baixa' — baixa pede conferência na tela
    observacao,
    criadoEm: agora.toISOString(),
    atualizadoEm: agora.toISOString(),
    antecedencias: escolhidas,   // quais avisos antes do prazo ela escolheu
    avisos: montarAvisos(Date.parse(prazoIso), agora.getTime(), escolhidas),
  };
}

/** Texto da notificação de um aviso. */
function textoDoAviso(lembrete, aviso) {
  return {
    titulo: aviso.rotulo,
    corpo: lembrete.detalhes ? `${lembrete.titulo} — ${lembrete.detalhes}` : lembrete.titulo,
    dados: { id: lembrete.id, chave: aviso.chave, prazo: lembrete.prazo },
  };
}

// Persistência em Postgres (Supabase), acessada pela API REST (PostgREST) com
// fetch puro — sem driver e sem conexão persistente, que é o que funciona bem
// em função serverless.
//
//   lembretes        o lembrete, com seus avisos em jsonb
//   avisos_fila      um registro por aviso a disparar, indexado pela hora
//   push_inscricoes  aparelhos inscritos no push
//
// A chave usada é a service_role, que ignora RLS. As tabelas têm RLS ligado e
// nenhuma policy permissiva, então a chave anônima não acessa nada.
const URL_BASE = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function armazenamentoConfigurado() {
  return Boolean(URL_BASE && CHAVE);
}

async function rest(caminho, opcoes = {}) {
  if (!armazenamentoConfigurado()) {
    throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados — veja o README.');
  }
  const resposta = await fetch(`${URL_BASE.replace(/\/$/, '')}/rest/v1${caminho}`, {
    ...opcoes,
    headers: {
      apikey: CHAVE,
      Authorization: `Bearer ${CHAVE}`,
      'Content-Type': 'application/json',
      ...(opcoes.headers || {}),
    },
  });
  const texto = await resposta.text();
  if (!resposta.ok) throw new Error(`Supabase ${resposta.status}: ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}

const selecionar = (caminho) => rest(caminho, { method: 'GET' });

const inserir = (tabela, linhas, { upsert = false } = {}) =>
  rest(`/${tabela}`, {
    method: 'POST',
    headers: { Prefer: upsert ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal' },
    body: JSON.stringify(linhas),
  });

const atualizar = (caminho, campos) =>
  rest(caminho, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(campos) });

const apagar = (caminho) => rest(caminho, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });

function novoId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Tradução entre a linha do banco e o objeto que o app usa ────────────────
const paraLinha = (l) => ({
  id: l.id,
  usuario: l.usuario,
  titulo: l.titulo,
  detalhes: l.detalhes || '',
  prazo: l.prazo,
  status: l.status,
  origem: l.origem || 'texto',
  motor: l.motor || 'manual',
  confianca: l.confianca || 'alta',
  observacao: l.observacao || '',
  antecedencias: l.antecedencias || [],
  avisos: l.avisos || [],
  criado_em: l.criadoEm,
  atualizado_em: l.atualizadoEm,
  concluido_em: l.concluidoEm || null,
});

const daLinha = (r) => ({
  id: r.id,
  usuario: r.usuario,
  titulo: r.titulo,
  detalhes: r.detalhes || '',
  // O Postgres devolve o timestamptz no formato dele; o app fala ISO 8601.
  prazo: new Date(r.prazo).toISOString(),
  status: r.status,
  origem: r.origem,
  motor: r.motor,
  confianca: r.confianca,
  observacao: r.observacao || '',
  antecedencias: r.antecedencias || [],
  avisos: r.avisos || [],
  criadoEm: r.criado_em ? new Date(r.criado_em).toISOString() : undefined,
  atualizadoEm: r.atualizado_em ? new Date(r.atualizado_em).toISOString() : undefined,
  ...(r.concluido_em ? { concluidoEm: new Date(r.concluido_em).toISOString() } : {}),
});

/** Só vai para a fila o aviso que ainda não foi enviado. */
const linhasDaFila = (id, avisos) =>
  avisos.filter((a) => !a.enviadoEm)
    .map((a) => ({ lembrete_id: id, chave: a.chave, disparar_em: a.em }));

// ─── Lembretes ───────────────────────────────────────────────────────────────
async function salvar(lembrete) {
  await inserir('lembretes', paraLinha(lembrete), { upsert: true });
  const fila = linhasDaFila(lembrete.id, lembrete.avisos);
  if (fila.length) await inserir('avisos_fila', fila, { upsert: true });
  return lembrete;
}

/**
 * @param {string} id
 * @param {string} [usuario] quando vem, o lembrete de outra conta responde como
 *   inexistente. O tick chama sem conta, porque percorre os avisos de todo mundo.
 */
async function obter(id, usuario) {
  const filtro = usuario ? `&usuario=eq.${encodeURIComponent(usuario)}` : '';
  const linhas = await selecionar(`/lembretes?id=eq.${encodeURIComponent(id)}${filtro}&select=*&limit=1`);
  return linhas?.length ? daLinha(linhas[0]) : null;
}

/** Troca os avisos de um lembrete: limpa a fila dele e enfileira os novos. */
async function reagendar(lembrete, avisos) {
  const atualizado = { ...lembrete, avisos, atualizadoEm: new Date().toISOString() };
  await inserir('lembretes', paraLinha(atualizado), { upsert: true });
  await apagar(`/avisos_fila?lembrete_id=eq.${encodeURIComponent(lembrete.id)}`);
  const fila = linhasDaFila(lembrete.id, avisos);
  if (fila.length) await inserir('avisos_fila', fila, { upsert: true });
  return atualizado;
}

async function listarPendentes(usuario) {
  const linhas = await selecionar(
    `/lembretes?usuario=eq.${encodeURIComponent(usuario)}&status=eq.pendente&select=*&order=prazo.asc`);
  return (linhas || []).map(daLinha);
}

async function listarFeitosRecentes(usuario, limite = 30) {
  const linhas = await selecionar(
    `/lembretes?usuario=eq.${encodeURIComponent(usuario)}&status=eq.feito&select=*&order=concluido_em.desc&limit=${limite}`);
  return (linhas || []).map(daLinha);
}

async function concluir(lembrete) {
  const agora = new Date().toISOString();
  const atualizado = { ...lembrete, status: 'feito', concluidoEm: agora, atualizadoEm: agora };
  await atualizar(`/lembretes?id=eq.${encodeURIComponent(lembrete.id)}`,
    { status: 'feito', concluido_em: agora, atualizado_em: agora });
  await apagar(`/avisos_fila?lembrete_id=eq.${encodeURIComponent(lembrete.id)}`);
  return atualizado;
}

async function remover(lembrete) {
  // A fila cai junto pelo ON DELETE CASCADE.
  await apagar(`/lembretes?id=eq.${encodeURIComponent(lembrete.id)}`);
}

async function gravarAvisos(lembrete, avisos) {
  const atualizado = { ...lembrete, avisos, atualizadoEm: new Date().toISOString() };
  await atualizar(`/lembretes?id=eq.${encodeURIComponent(lembrete.id)}`,
    { avisos, atualizado_em: atualizado.atualizadoEm });
  return atualizado;
}

async function marcarAvisoEnviado(lembrete, chave) {
  const avisos = lembrete.avisos.map((a) =>
    a.chave === chave ? { ...a, enviadoEm: new Date().toISOString() } : a);
  return gravarAvisos(lembrete, avisos);
}

// ─── Fila de avisos ──────────────────────────────────────────────────────────
/**
 * Pega os avisos vencidos E os tira da fila no mesmo passo, dentro do banco.
 * Antes isso eram duas chamadas seguidas; aqui é atômico, então dois ticks
 * sobrepostos nunca disparam o mesmo aviso duas vezes.
 */
async function avisosVencidos(agoraMs = Date.now(), limite = 50) {
  const linhas = await rest('/rpc/pegar_avisos_vencidos', {
    method: 'POST',
    body: JSON.stringify({ limite }),
  });
  return (linhas || []).map((r) => ({
    membro: `${r.lembrete_id}#${r.chave}`,
    id: r.lembrete_id,
    chave: r.chave,
  }));
}

async function reenfileirar(id, chave, quandoMs) {
  await inserir('avisos_fila',
    { lembrete_id: id, chave, disparar_em: new Date(quandoMs).toISOString() },
    { upsert: true });
}

// ─── Inscrições de push ──────────────────────────────────────────────────────
const idDaInscricao = (endpoint) => Buffer.from(endpoint).toString('base64url').slice(-48);

async function guardarInscricao(usuario, inscricao, apelido = '') {
  await inserir('push_inscricoes', {
    id: idDaInscricao(inscricao.endpoint),
    usuario,
    inscricao,
    apelido,
    criada_em: new Date().toISOString(),
  }, { upsert: true });
}

/** Aparelhos de uma conta. Sem conta não devolve nada: notificação de uma
 *  pessoa nunca deve sair no celular de outra. */
async function listarInscricoes(usuario) {
  if (!usuario) return [];
  const linhas = await selecionar(`/push_inscricoes?usuario=eq.${encodeURIComponent(usuario)}&select=*`);
  return (linhas || []).map((r) => ({
    id: r.id, usuario: r.usuario, inscricao: r.inscricao, apelido: r.apelido, criadaEm: r.criada_em,
  }));
}

async function descartarInscricao(id) {
  await apagar(`/push_inscricoes?id=eq.${encodeURIComponent(id)}`);
}

/**
 * Autentica e passa pelo limite de tentativas numa chamada só.
 * A senha é conferida contra o hash bcrypt dentro do banco — em nenhum momento
 * uma senha em claro é comparada aqui.
 */
async function autenticarAcesso(usuario, senha, ip) {
  const linhas = await rest('/rpc/autenticar_acesso', {
    method: 'POST',
    body: JSON.stringify({
      p_usuario: usuario || '', p_senha: senha || '', p_ip: ip || 'desconhecido',
    }),
  });
  const r = linhas?.[0];
  if (!r) return { permitido: false, usuario: null, bloqueadoAte: null, erros: 0 };
  return { permitido: r.permitido, usuario: r.usuario, bloqueadoAte: r.bloqueado_ate, erros: r.erros };
}

// Despacho de avisos. A lista de canais é a costura de extensão do sistema: hoje
// só existe o push do PWA; acrescentar Telegram ou WhatsApp é acrescentar um
// objeto aqui com a mesma interface, sem tocar no resto do núcleo.
//
//   { nome, disponivel(): boolean, enviar({titulo, corpo, dados}): Promise }



// Lido sob demanda: na Edge Function a configuração chega depois do import.
const assuntoVapid = () => process.env.VAPID_SUBJECT || 'mailto:beareisfarma@gmail.com';

function vapidPronto() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

const canalPush = {
  nome: 'push',
  disponivel: vapidPronto,
  async enviar({ titulo, corpo, dados }, usuario) {
    webpush.setVapidDetails(assuntoVapid(), process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const inscricoes = await listarInscricoes(usuario);
    if (inscricoes.length === 0) return { enviados: 0, removidos: 0, motivo: 'nenhum aparelho inscrito' };

    const carga = JSON.stringify({ titulo, corpo, dados });
    let enviados = 0;
    const mortas = [];

    await Promise.all(inscricoes.map(async (registro) => {
      try {
        await webpush.sendNotification(registro.inscricao, carga, { TTL: 6 * 3600, urgency: 'high' });
        enviados++;
      } catch (erro) {
        // 404/410 = a inscrição morreu (app desinstalado, permissão revogada).
        // Qualquer outro código é falha temporária e a inscrição fica.
        if (erro?.statusCode === 404 || erro?.statusCode === 410) mortas.push(registro.id);
        else console.error('[push] falha', erro?.statusCode, erro?.body || erro?.message);
      }
    }));

    for (const id of mortas) await descartarInscricao(id);
    return { enviados, removidos: mortas.length };
  },
};

const CANAIS = [canalPush];

function canaisAtivos() {
  return CANAIS.filter((c) => c.disponivel());
}

/**
 * Envia por todos os canais ativos, só para os aparelhos da conta dona do
 * lembrete. Um canal que falha não derruba os outros.
 */
async function despachar(mensagem, usuario) {
  const ativos = canaisAtivos();
  if (ativos.length === 0) return [{ canal: 'nenhum', erro: 'nenhum canal configurado' }];

  return Promise.all(ativos.map(async (canal) => {
    try {
      return { canal: canal.nome, ...(await canal.enviar(mensagem, usuario)) };
    } catch (erro) {
      console.error(`[${canal.nome}] erro no despacho`, erro);
      return { canal: canal.nome, erro: erro.message };
    }
  }));
}


// ─── Configuração ────────────────────────────────────────────────────────────
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente da função.
// O resto (chaves VAPID, PIN, segredo do cron) mora na tabela config_app, que
// tem RLS ligado sem policy — só a chave de serviço lê. Segredo não fica em
// arquivo nem no git; fica no banco, onde já está protegido.
let configCarregada = false;
async function carregarConfig() {
  if (configCarregada) return;
  // Sem regex de propósito: barra invertida dentro do template literal deste
  // gerador some, e o erro só aparece no bundle do Deno.
  const cru = process.env.SUPABASE_URL || '';
  const base = cru.endsWith('/') ? cru.slice(0, -1) : cru;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(base + '/rest/v1/config_app?select=chave,valor', {
    headers: { apikey: chave, Authorization: 'Bearer ' + chave },
  });
  if (!r.ok) throw new Error('Não consegui ler config_app: ' + r.status);
  for (const linha of await r.json()) {
    if (linha.valor) process.env[linha.chave] = linha.valor;
  }
  configCarregada = true;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lembretes-pin, x-lembretes-usuario',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

const json = (corpo, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
const erro = (status, mensagem) => json({ erro: mensagem }, status);

function iguais(a, b) {
  const ba = new TextEncoder().encode(String(a ?? ''));
  const bb = new TextEncoder().encode(String(b ?? ''));
  if (ba.length === 0 || ba.length !== bb.length) return false;
  let diferenca = 0;
  for (let i = 0; i < ba.length; i++) diferenca |= ba[i] ^ bb[i];
  return diferenca === 0;   // tempo constante: não vaza o PIN por cronometragem
}

const autorizadoCron = (req, url) =>
  iguais((req.headers.get('authorization') || '').replace(/^Bearer /, ''), process.env.CRON_SECRET)
  || iguais(url.searchParams.get('chave'), process.env.CRON_SECRET);

const enriquecer = (l, agora) => ({
  ...l,
  falta: comoFalta(Date.parse(l.prazo), agora),
  faixa: faixa(Date.parse(l.prazo), agora),
  proximoAviso: l.avisos.filter((a) => !a.enviadoEm && Date.parse(a.em) > agora)
    .sort((a, b) => Date.parse(a.em) - Date.parse(b.em))[0] || null,
});

/** Interpretação: o parser local resolve; sem data, vira palpite para amanhã. */
function interpretar(recado, agora) {
  const texto = String(recado || '').trim();
  if (!texto) throw new Error('Recado vazio.');
  const local = interpretarLocal(texto, agora);
  if (local) return local;
  const amanha = new Date(agora.getTime() + DIA_MS);
  const [dia] = textoLocal(amanha).split('T');
  return {
    titulo: texto.replace(/\s+/g, ' ').slice(0, 120), detalhes: '',
    prazo: deLocalParaUTC(`${dia}T${String(HORA_PADRAO).padStart(2, '0')}:00`),
    horaExplicita: false, confianca: 'baixa', motor: 'palpite',
    observacao: 'Não identifiquei data no recado — deixei para amanhã. Ajuste o prazo.',
  };
}

// ─── Roteador ────────────────────────────────────────────────────────────────
// Mesma semântica dos endpoints em api/: reminders, subscribe, transcribe, tick.
const MAX_TENTATIVAS = 3;
const ESPERA_RETENTATIVA_MS = 5 * 60000;
const COBRANCA_ATRASO_MS = 2 * 3600000;

/** Origem da requisição, para contar tentativas por aparelho/rede. */
const origem = (req) =>
  (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
  || req.headers.get('cf-connecting-ip') || 'desconhecido';

/**
 * Autentica e passa pelo contador de tentativas.
 * Devolve `{ usuario }` quando pode seguir, ou `{ resposta }` com o erro pronto.
 */
async function autenticar(req) {
  const r = await autenticarAcesso(
    req.headers.get('x-lembretes-usuario'),
    req.headers.get('x-lembretes-pin'),
    origem(req));
  if (r.permitido) return { usuario: r.usuario };
  if (r.bloqueadoAte && new Date(r.bloqueadoAte) > new Date()) {
    const minutos = Math.max(1, Math.ceil((new Date(r.bloqueadoAte) - Date.now()) / 60000));
    return { resposta: erro(429, `Muitas tentativas. Tente de novo em ${minutos} min.`) };
  }
  return { resposta: erro(401, 'Usuário ou senha incorretos.') };
}

async function rotear(req) {
  const url = new URL(req.url);
  // O caminho que chega aqui varia conforme o Supabase roteia: pode vir como
  // /functions/v1/api/reminders, /api/reminders ou só /reminders. Normaliza os
  // três em vez de apostar num.
  const rota = url.pathname
    .replace(/^\/+/, '')
    .replace(/^functions\/v1\/?/, '')
    .replace(/^api\/?/, '')
    .replace(/\/+$/, '');

  if (rota === 'tick') return await tick(req, url);
  if (rota === 'subscribe') return await subscribe(req);
  if (rota === 'transcribe') return await transcribe(req);
  if (rota === 'reminders') return await reminders(req, url);
  if (rota === '' || rota === 'saude') {
    // Diagnóstico sem segredo: diz o que está configurado, nunca os valores.
    return json({
      ok: true,
      banco: armazenamentoConfigurado(),
      push: canaisAtivos().map((c) => c.nome),
      pin: Boolean(process.env.APP_PIN),
      cron: Boolean(process.env.CRON_SECRET),
      audio: Boolean(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY),
    });
  }
  return erro(404, 'Rota desconhecida.');
}

async function subscribe(req) {
  if (req.method === 'GET') {
    const chave = process.env.VAPID_PUBLIC_KEY;
    return chave ? json({ chavePublica: chave }) : erro(503, 'VAPID_PUBLIC_KEY ausente.');
  }
  if (req.method !== 'POST') return erro(405, 'Método não permitido.');
  const { usuario, resposta } = await autenticar(req); if (resposta) return resposta;

  const { inscricao, apelido } = await req.json();
  if (!inscricao?.endpoint || !inscricao?.keys?.p256dh || !inscricao?.keys?.auth) {
    return erro(400, 'Inscrição de push incompleta.');
  }
  await guardarInscricao(usuario, inscricao, String(apelido || '').slice(0, 60));
  return json({ ok: true }, 201);
}

async function transcribe(req) {
  if (req.method !== 'POST') return erro(405, 'Método não permitido.');
  // nome diferente: mais abaixo `resposta` já é a resposta do serviço de áudio
  const negado = (await autenticar(req)).resposta; if (negado) return negado;

  const provedores = [
    { nome: 'groq', chave: process.env.GROQ_API_KEY,
      url: 'https://api.groq.com/openai/v1/audio/transcriptions', modelo: 'whisper-large-v3-turbo' },
    { nome: 'openai', chave: process.env.OPENAI_API_KEY,
      url: 'https://api.openai.com/v1/audio/transcriptions', modelo: 'whisper-1' },
  ];
  const provedor = provedores.find((p) => p.chave);
  if (!provedor) return erro(503, 'Transcrição indisponível: defina GROQ_API_KEY ou OPENAI_API_KEY.');

  const { audio, mime } = await req.json();
  if (!audio) return erro(400, 'Envie o áudio em base64 no campo "audio".');
  const bytes = Buffer.from(audio, 'base64');
  if (!bytes.length) return erro(400, 'Áudio vazio.');
  if (bytes.length > 4 * 1024 * 1024) return erro(413, 'Áudio grande demais — grave até 2 minutos.');

  const tipo = String(mime || 'audio/webm').split(';')[0];
  const extensao = { 'audio/mp4': 'mp4', 'audio/m4a': 'm4a', 'audio/x-m4a': 'm4a',
    'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' }[tipo] || 'webm';

  const form = new FormData();
  form.append('file', new Blob([bytes], { type: tipo }), `recado.${extensao}`);
  form.append('model', provedor.modelo);
  form.append('language', 'pt');
  form.append('response_format', 'json');

  const resposta = await fetch(provedor.url, {
    method: 'POST', headers: { Authorization: `Bearer ${provedor.chave}` }, body: form,
  });
  const bruto = await resposta.text();
  if (!resposta.ok) {
    console.error(`[transcricao/${provedor.nome}]`, resposta.status, bruto.slice(0, 300));
    return erro(502, `Falha ao transcrever (${provedor.nome} ${resposta.status}).`);
  }
  const texto = String(JSON.parse(bruto).text || '').trim();
  if (!texto) return erro(422, 'Não consegui entender o áudio. Tente de novo ou digite.');
  return json({ texto, provedor: provedor.nome });
}

async function reminders(req, url) {
  if (!armazenamentoConfigurado()) return erro(503, 'Banco não configurado.');
  const { usuario, resposta } = await autenticar(req); if (resposta) return resposta;

  const id = url.searchParams.get('id');
  const agora = Date.now();

  if (req.method === 'GET') {
    const [pendentes, feitos] = await Promise.all([
      listarPendentes(usuario), listarFeitosRecentes(usuario, 20)]);
    return json({
      agora: new Date(agora).toISOString(),
      pendentes: pendentes.map((l) => enriquecer(l, agora)),
      feitos: feitos.map((l) => enriquecer(l, agora)),
    });
  }

  if (req.method === 'POST') {
    const corpo = await req.json();
    let lembrete;
    if (corpo.recado) {
      const lido = interpretar(corpo.recado, new Date(agora));
      // A observação que ela escreveu vence a que o interpretador deduziu.
      lembrete = criarLembrete({ ...lido,
        detalhes: corpo.detalhes !== undefined ? String(corpo.detalhes).slice(0, 500) : lido.detalhes,
        origem: corpo.origem || 'texto', antecedencias: corpo.antecedencias, agora: new Date(agora) });
    } else if (corpo.titulo && corpo.prazo) {
      const prazo = new Date(corpo.prazo);
      if (Number.isNaN(prazo.getTime())) return erro(400, 'Prazo inválido.');
      lembrete = criarLembrete({ titulo: String(corpo.titulo).slice(0, 120),
        detalhes: String(corpo.detalhes || '').slice(0, 500), prazo,
        origem: corpo.origem || 'texto', antecedencias: corpo.antecedencias, agora: new Date(agora) });
    } else {
      return erro(400, 'Envie "recado" (texto livre) ou "titulo" + "prazo".');
    }
    await salvar({ ...lembrete, usuario });
    return json({ lembrete: enriquecer(lembrete, agora) }, 201);
  }

  if (!id) return erro(400, 'Informe ?id=');
  // Escopado pela conta: o lembrete de outra pessoa responde como inexistente.
  const lembrete = await obter(id, usuario);
  if (!lembrete) return erro(404, 'Lembrete não encontrado.');

  if (req.method === 'DELETE') { await remover(lembrete); return json({ removido: id }); }
  if (req.method !== 'PATCH') return erro(405, 'Método não permitido.');

  const corpo = await req.json();
  switch (corpo.acao) {
    case 'concluir':
      return json({ lembrete: enriquecer(await concluir(lembrete), agora) });

    case 'adiar': {
      // Adiar move o AVISO, nunca o prazo.
      const minutos = Number(corpo.minutos);
      if (!Number.isFinite(minutos) || minutos <= 0 || minutos > 60 * 24 * 30) {
        return erro(400, 'Informe "minutos" entre 1 e 43200.');
      }
      const soneca = { chave: `soneca-${agora.toString(36)}`,
        em: new Date(agora + minutos * 60000).toISOString(),
        rotulo: 'Você pediu para lembrar de novo' };
      return json({ lembrete: enriquecer(await reagendar(lembrete, [...lembrete.avisos, soneca]), agora) });
    }

    case 'reabrir': {
      const reaberto = { ...lembrete, status: 'pendente', concluidoEm: undefined };
      return json({ lembrete: enriquecer(await reagendar(reaberto,
        montarAvisos(Date.parse(reaberto.prazo), agora, reaberto.antecedencias)), agora) });
    }

    case 'editar': {
      const titulo = corpo.titulo !== undefined ? String(corpo.titulo).slice(0, 120) : lembrete.titulo;
      const detalhes = corpo.detalhes !== undefined ? String(corpo.detalhes).slice(0, 500) : lembrete.detalhes;
      if (!titulo.trim()) return erro(400, 'O título não pode ficar vazio.');
      let prazo = lembrete.prazo;
      if (corpo.prazo) {
        const novo = new Date(corpo.prazo);
        if (Number.isNaN(novo.getTime())) return erro(400, 'Prazo inválido.');
        prazo = novo.toISOString();
      }
      const antecedencias = corpo.antecedencias !== undefined
        ? normalizarAntecedencias(corpo.antecedencias) : lembrete.antecedencias;
      // Mudou prazo ou antecedência? A escada antiga deixou de fazer sentido.
      const mudou = corpo.prazo !== undefined || corpo.antecedencias !== undefined;
      const avisos = mudou ? montarAvisos(Date.parse(prazo), agora, antecedencias) : lembrete.avisos;
      return json({ lembrete: enriquecer(await reagendar(
        { ...lembrete, titulo, detalhes, prazo, antecedencias, confianca: 'alta', observacao: '' },
        avisos), agora) });
    }
    default:
      return erro(400, 'Ação desconhecida. Use concluir, adiar, reabrir ou editar.');
  }
}

async function tick(req, url) {
  if (!autorizadoCron(req, url)) return erro(401, 'Segredo do cron inválido.');
  if (!armazenamentoConfigurado()) return erro(503, 'Banco não configurado.');

  const agora = Date.now();
  // Pega e remove os vencidos num passo atômico dentro do banco.
  const vencidos = await avisosVencidos(agora);
  if (!vencidos.length) {
    return json({ agora: new Date(agora).toISOString(), disparados: 0,
      canais: canaisAtivos().map((c) => c.nome) });
  }

  const relatorio = [];
  for (const vencido of vencidos) {
    const lembrete = await obter(vencido.id);
    if (!lembrete) { relatorio.push({ id: vencido.id, resultado: 'lembrete inexistente' }); continue; }
    if (lembrete.status !== 'pendente') { relatorio.push({ id: vencido.id, resultado: 'já concluído' }); continue; }
    const aviso = lembrete.avisos.find((a) => a.chave === vencido.chave);
    if (!aviso) { relatorio.push({ id: vencido.id, resultado: 'aviso desconhecido' }); continue; }
    if (aviso.enviadoEm) { relatorio.push({ id: vencido.id, resultado: 'já enviado' }); continue; }

    const resultados = await despachar(textoDoAviso(lembrete, aviso), lembrete.usuario);
    const entregues = resultados.reduce((t, r) => t + (r.enviados || 0), 0);
    const tentativas = (aviso.tentativas || 0) + 1;

    if (entregues === 0 && tentativas < MAX_TENTATIVAS) {
      // Ninguém recebeu: tenta de novo em vez de engolir o lembrete.
      await gravarAvisos(lembrete, lembrete.avisos.map((a) =>
        a.chave === aviso.chave ? { ...a, tentativas } : a));
      await reenfileirar(lembrete.id, aviso.chave, agora + ESPERA_RETENTATIVA_MS);
      relatorio.push({ id: lembrete.id, chave: aviso.chave,
        resultado: 'sem entrega, retentativa agendada', tentativas });
      continue;
    }

    const avisos = lembrete.avisos.map((a) => a.chave === aviso.chave
      ? { ...a, tentativas, enviadoEm: new Date(agora).toISOString(), entregues } : a);

    // Prazo estourado e ainda pendente: cobra uma vez, duas horas depois.
    let cobranca = null;
    if (aviso.chave === 'prazo' && entregues > 0) {
      cobranca = { chave: 'atraso', em: new Date(agora + COBRANCA_ATRASO_MS).toISOString(),
        rotulo: 'Passou do prazo e ainda está pendente' };
      avisos.push(cobranca);
    }
    await gravarAvisos(lembrete, avisos);
    if (cobranca) await reenfileirar(lembrete.id, cobranca.chave, Date.parse(cobranca.em));

    relatorio.push({ id: lembrete.id, chave: aviso.chave, titulo: lembrete.titulo,
      resultado: entregues > 0 ? 'entregue' : 'desistiu após 3 tentativas', entregues });
  }

  return json({ agora: new Date(agora).toISOString(), disparados: relatorio.length,
    canais: canaisAtivos().map((c) => c.nome), relatorio });
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    await carregarConfig();
    return await rotear(req);
  } catch (e) {
    console.error('[erro não tratado]', e);
    return erro(500, e?.message || 'Erro interno.');
  }
});
