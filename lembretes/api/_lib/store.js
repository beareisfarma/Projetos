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

export function armazenamentoConfigurado() {
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

export function novoId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Tradução entre a linha do banco e o objeto que o app usa ────────────────
const paraLinha = (l) => ({
  id: l.id,
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
export async function salvar(lembrete) {
  await inserir('lembretes', paraLinha(lembrete), { upsert: true });
  const fila = linhasDaFila(lembrete.id, lembrete.avisos);
  if (fila.length) await inserir('avisos_fila', fila, { upsert: true });
  return lembrete;
}

export async function obter(id) {
  const linhas = await selecionar(`/lembretes?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  return linhas?.length ? daLinha(linhas[0]) : null;
}

/** Troca os avisos de um lembrete: limpa a fila dele e enfileira os novos. */
export async function reagendar(lembrete, avisos) {
  const atualizado = { ...lembrete, avisos, atualizadoEm: new Date().toISOString() };
  await inserir('lembretes', paraLinha(atualizado), { upsert: true });
  await apagar(`/avisos_fila?lembrete_id=eq.${encodeURIComponent(lembrete.id)}`);
  const fila = linhasDaFila(lembrete.id, avisos);
  if (fila.length) await inserir('avisos_fila', fila, { upsert: true });
  return atualizado;
}

export async function listarPendentes() {
  const linhas = await selecionar('/lembretes?status=eq.pendente&select=*&order=prazo.asc');
  return (linhas || []).map(daLinha);
}

export async function listarFeitosRecentes(limite = 30) {
  const linhas = await selecionar(`/lembretes?status=eq.feito&select=*&order=concluido_em.desc&limit=${limite}`);
  return (linhas || []).map(daLinha);
}

export async function concluir(lembrete) {
  const agora = new Date().toISOString();
  const atualizado = { ...lembrete, status: 'feito', concluidoEm: agora, atualizadoEm: agora };
  await atualizar(`/lembretes?id=eq.${encodeURIComponent(lembrete.id)}`,
    { status: 'feito', concluido_em: agora, atualizado_em: agora });
  await apagar(`/avisos_fila?lembrete_id=eq.${encodeURIComponent(lembrete.id)}`);
  return atualizado;
}

export async function remover(lembrete) {
  // A fila cai junto pelo ON DELETE CASCADE.
  await apagar(`/lembretes?id=eq.${encodeURIComponent(lembrete.id)}`);
}

export async function gravarAvisos(lembrete, avisos) {
  const atualizado = { ...lembrete, avisos, atualizadoEm: new Date().toISOString() };
  await atualizar(`/lembretes?id=eq.${encodeURIComponent(lembrete.id)}`,
    { avisos, atualizado_em: atualizado.atualizadoEm });
  return atualizado;
}

export async function marcarAvisoEnviado(lembrete, chave) {
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
export async function avisosVencidos(agoraMs = Date.now(), limite = 50) {
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

export async function reenfileirar(id, chave, quandoMs) {
  await inserir('avisos_fila',
    { lembrete_id: id, chave, disparar_em: new Date(quandoMs).toISOString() },
    { upsert: true });
}

// ─── Inscrições de push ──────────────────────────────────────────────────────
const idDaInscricao = (endpoint) => Buffer.from(endpoint).toString('base64url').slice(-48);

export async function guardarInscricao(inscricao, apelido = '') {
  await inserir('push_inscricoes', {
    id: idDaInscricao(inscricao.endpoint),
    inscricao,
    apelido,
    criada_em: new Date().toISOString(),
  }, { upsert: true });
}

export async function listarInscricoes() {
  const linhas = await selecionar('/push_inscricoes?select=*');
  return (linhas || []).map((r) => ({
    id: r.id, inscricao: r.inscricao, apelido: r.apelido, criadaEm: r.criada_em,
  }));
}

export async function descartarInscricao(id) {
  await apagar(`/push_inscricoes?id=eq.${encodeURIComponent(id)}`);
}

/**
 * Autoriza (ou nega) uma tentativa de acesso, contando erros por origem.
 * Uma chamada só: verifica o bloqueio, registra o erro e bloqueia se passar do
 * limite. Bloqueado continua bloqueado mesmo com a senha certa — é isso que
 * impede alguém de simplesmente continuar chutando até acertar.
 */
export async function verificarAcesso(ip, credencialOk) {
  const linhas = await rest('/rpc/verificar_acesso', {
    method: 'POST',
    body: JSON.stringify({ p_ip: ip || 'desconhecido', p_credencial_ok: Boolean(credencialOk) }),
  });
  const r = linhas?.[0];
  if (!r) return { permitido: Boolean(credencialOk), bloqueadoAte: null, erros: 0 };
  return { permitido: r.permitido, bloqueadoAte: r.bloqueado_ate, erros: r.erros };
}
