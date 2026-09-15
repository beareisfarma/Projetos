// Monta a Edge Function do Supabase a partir dos MESMOS módulos que os testes
// exercitam — tempo, agenda, interpretador-local, lembrete, store e canais são
// copiados sem alteração de lógica, só com os import/export removidos para
// viverem num arquivo só no runtime Deno.
//
// Por que a API vive aqui e não na Vercel: dentro do Supabase a chave de serviço
// já existe no ambiente, então nenhuma variável precisa ser cadastrada à mão em
// lugar nenhum. A Vercel passa a servir só a tela.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const raiz = new URL('../', import.meta.url).pathname;
const semModulos = (arquivo) =>
  readFileSync(raiz + arquivo, 'utf8')
    .replace(/^import[\s\S]*?;$/gm, '')
    .replace(/^export (?=(function|const|async|class))/gm, '')
    .replace(/^export \{[^}]*\};$/gm, '');

const nucleo = [
  'tempo.js', 'agenda.js', 'interpretador-local.js', 'lembrete.js', 'store.js', 'canais.js',
].map((f) => semModulos('api/_lib/' + f)).join('\n');

const funcao = `// GERADO por scripts/montar-funcao.mjs — não edite aqui.
// Edite os módulos em api/_lib/ e rode: npm run build:funcao
// O runtime das Edge Functions proíbe escrever em Deno.env — qualquer
// process.env.X = ... vira \"The operation is not supported\". Então este
// process é nosso: começa com o ambiente da plataforma e aceita a
// configuração vinda da tabela config_app por cima.
const process = { env: { ...Deno.env.toObject() } };
import { Buffer } from 'node:buffer';
import webpush from 'npm:web-push@3.6.7';

${nucleo}

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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lembretes-pin',
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

const autorizado = (req) => iguais(req.headers.get('x-lembretes-pin'), process.env.APP_PIN);
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
    titulo: texto.replace(/\\s+/g, ' ').slice(0, 120), detalhes: '',
    prazo: deLocalParaUTC(\`\${dia}T\${String(HORA_PADRAO).padStart(2, '0')}:00\`),
    horaExplicita: false, confianca: 'baixa', motor: 'palpite',
    observacao: 'Não identifiquei data no recado — deixei para amanhã. Ajuste o prazo.',
  };
}

${readFileSync(raiz + 'scripts/rotas-funcao.js', 'utf8')}

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
`;

mkdirSync(raiz + 'supabase/functions/api', { recursive: true });
const destino = raiz + 'supabase/functions/api/index.ts';
writeFileSync(destino, funcao);
console.log('função montada:', (funcao.length / 1024).toFixed(1) + 'KB →', destino);
