// Persistência em Redis (Upstash) pela API REST — sem driver, sem conexão
// persistente, que é o que funciona bem em função serverless. Três estruturas:
//
//   lem:<id>    string JSON  — o lembrete
//   lem:index   zset         — pendentes, ordenados pelo prazo (para a lista)
//   lem:fila    zset         — avisos a disparar, ordenados pela hora do aviso
//   lem:feitos  zset         — histórico do que foi concluído
//   push:subs   hash         — inscrições de push, por endpoint
//
// A fila guarda um membro por aviso ("<id>#<chave>"), então o tick é idempotente:
// dispara, remove o membro, e um disparo repetido não encontra mais nada.
const URL_BASE = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export function armazenamentoConfigurado() {
  return Boolean(URL_BASE && TOKEN);
}

async function chamar(caminho, corpo) {
  if (!armazenamentoConfigurado()) {
    throw new Error('UPSTASH_REDIS_REST_URL/TOKEN não configurados — veja o README.');
  }
  const resposta = await fetch(`${URL_BASE.replace(/\/$/, '')}${caminho}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const texto = await resposta.text();
  if (!resposta.ok) throw new Error(`Redis ${resposta.status}: ${texto.slice(0, 300)}`);
  return JSON.parse(texto);
}

const cmd = async (...partes) => (await chamar('/', partes)).result;
const pipeline = async (comandos) => {
  if (comandos.length === 0) return [];
  const saida = await chamar('/pipeline', comandos);
  const erro = saida.find((r) => r.error);
  if (erro) throw new Error(`Redis pipeline: ${erro.error}`);
  return saida.map((r) => r.result);
};

const chaveLembrete = (id) => `lem:${id}`;
const membroAviso = (id, chave) => `${id}#${chave}`;

export function novoId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function salvar(lembrete) {
  const prazoMs = Date.parse(lembrete.prazo);
  const comandos = [
    ['SET', chaveLembrete(lembrete.id), JSON.stringify(lembrete)],
    ['ZADD', 'lem:index', prazoMs, lembrete.id],
  ];
  for (const aviso of lembrete.avisos) {
    comandos.push(['ZADD', 'lem:fila', Date.parse(aviso.em), membroAviso(lembrete.id, aviso.chave)]);
  }
  await pipeline(comandos);
  return lembrete;
}

export async function obter(id) {
  const bruto = await cmd('GET', chaveLembrete(id));
  return bruto ? JSON.parse(bruto) : null;
}

/** Substitui os avisos de um lembrete: limpa os antigos da fila e enfileira os novos. */
export async function reagendar(lembrete, avisos) {
  const antigos = lembrete.avisos.map((a) => ['ZREM', 'lem:fila', membroAviso(lembrete.id, a.chave)]);
  const atualizado = { ...lembrete, avisos, atualizadoEm: new Date().toISOString() };
  // Só volta para a fila o aviso que ainda não foi enviado e cuja hora não passou:
  // o histórico fica no registro, mas nada já disparado dispara de novo.
  const novos = avisos
    .filter((a) => !a.enviadoEm)
    .map((a) => ['ZADD', 'lem:fila', Date.parse(a.em), membroAviso(lembrete.id, a.chave)]);
  await pipeline([
    ...antigos,
    ['SET', chaveLembrete(lembrete.id), JSON.stringify(atualizado)],
    ['ZADD', 'lem:index', Date.parse(atualizado.prazo), lembrete.id],
    ...novos,
  ]);
  return atualizado;
}

export async function listarPendentes() {
  const ids = await cmd('ZRANGE', 'lem:index', 0, -1);
  if (!ids || ids.length === 0) return [];
  const brutos = await cmd('MGET', ...ids.map(chaveLembrete));
  return brutos.filter(Boolean).map((b) => JSON.parse(b));
}

export async function listarFeitosRecentes(limite = 30) {
  const ids = await cmd('ZRANGE', 'lem:feitos', 0, limite - 1, 'REV');
  if (!ids || ids.length === 0) return [];
  const brutos = await cmd('MGET', ...ids.map(chaveLembrete));
  return brutos.filter(Boolean).map((b) => JSON.parse(b));
}

export async function concluir(lembrete) {
  const agora = new Date().toISOString();
  const atualizado = { ...lembrete, status: 'feito', concluidoEm: agora };
  await pipeline([
    ['SET', chaveLembrete(lembrete.id), JSON.stringify(atualizado)],
    ['ZREM', 'lem:index', lembrete.id],
    ...lembrete.avisos.map((a) => ['ZREM', 'lem:fila', membroAviso(lembrete.id, a.chave)]),
    ['ZADD', 'lem:feitos', Date.parse(agora), lembrete.id],
  ]);
  return atualizado;
}

export async function remover(lembrete) {
  await pipeline([
    ['DEL', chaveLembrete(lembrete.id)],
    ['ZREM', 'lem:index', lembrete.id],
    ['ZREM', 'lem:feitos', lembrete.id],
    ...lembrete.avisos.map((a) => ['ZREM', 'lem:fila', membroAviso(lembrete.id, a.chave)]),
  ]);
}

/** Avisos cuja hora já chegou. Cada um sai da fila assim que é lido. */
export async function avisosVencidos(agoraMs = Date.now(), limite = 50) {
  const membros = await cmd('ZRANGE', 'lem:fila', 0, agoraMs, 'BYSCORE', 'LIMIT', 0, limite);
  return (membros || []).map((m) => {
    const corte = m.lastIndexOf('#');
    return { membro: m, id: m.slice(0, corte), chave: m.slice(corte + 1) };
  });
}

export async function tirarDaFila(membros) {
  if (membros.length === 0) return;
  await pipeline(membros.map((m) => ['ZREM', 'lem:fila', m]));
}

export async function marcarAvisoEnviado(lembrete, chave) {
  const avisos = lembrete.avisos.map((a) =>
    a.chave === chave ? { ...a, enviadoEm: new Date().toISOString() } : a);
  const atualizado = { ...lembrete, avisos };
  await cmd('SET', chaveLembrete(lembrete.id), JSON.stringify(atualizado));
  return atualizado;
}

// ─── Inscrições de push ──────────────────────────────────────────────────────
const idDaInscricao = (endpoint) =>
  Buffer.from(endpoint).toString('base64url').slice(-48);

export async function guardarInscricao(inscricao, apelido = '') {
  await cmd('HSET', 'push:subs', idDaInscricao(inscricao.endpoint),
    JSON.stringify({ inscricao, apelido, criadaEm: new Date().toISOString() }));
}

export async function listarInscricoes() {
  const mapa = await cmd('HGETALL', 'push:subs');
  if (!mapa) return [];
  // O Upstash devolve HGETALL como objeto ou como lista plana, dependendo da versão.
  const entradas = Array.isArray(mapa)
    ? mapa.reduce((acc, v, i) => (i % 2 ? acc : [...acc, [mapa[i], mapa[i + 1]]]), [])
    : Object.entries(mapa);
  return entradas.map(([id, valor]) => ({ id, ...JSON.parse(valor) }));
}

export async function descartarInscricao(id) {
  await cmd('HDEL', 'push:subs', id);
}

/** Recoloca um aviso na fila (retentativa ou cobrança de atraso). */
export async function reenfileirar(id, chave, quandoMs) {
  await cmd('ZADD', 'lem:fila', quandoMs, membroAviso(id, chave));
}

/** Grava a lista de avisos de um lembrete sem mexer na fila. */
export async function gravarAvisos(lembrete, avisos) {
  const atualizado = { ...lembrete, avisos, atualizadoEm: new Date().toISOString() };
  await cmd('SET', chaveLembrete(lembrete.id), JSON.stringify(atualizado));
  return atualizado;
}
