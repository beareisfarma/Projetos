// Utilidades comuns aos endpoints: resposta JSON, leitura de corpo e as duas
// portas de autenticação (o PIN da dona do app e o segredo do cron).
import { timingSafeEqual } from 'node:crypto';
import { autenticarAcesso } from './store.js';

export function json(res, status, corpo) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(corpo));
}

export const erro = (res, status, mensagem) => json(res, status, { erro: mensagem });

/** Comparação de segredos em tempo constante, tolerante a tamanhos diferentes. */
function iguais(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Autentica a requisição contra a tabela de contas, passando pelo limite de
 * tentativas. Devolve `{ usuario }` ou `{ negado: {status, mensagem} }`.
 *
 * Esta é a variante Vercel, mantida como reserva; o que está publicado é a Edge
 * Function. As duas usam a mesma função do banco, para não divergirem.
 */
export async function autenticarRequisicao(req) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress || 'desconhecido';
  const r = await autenticarAcesso(req.headers['x-lembretes-usuario'], req.headers['x-lembretes-pin'], ip);
  if (r.permitido) return { usuario: r.usuario };
  if (r.bloqueadoAte && new Date(r.bloqueadoAte) > new Date()) {
    const minutos = Math.max(1, Math.ceil((new Date(r.bloqueadoAte) - Date.now()) / 60000));
    return { negado: { status: 429, mensagem: `Muitas tentativas. Tente de novo em ${minutos} min.` } };
  }
  return { negado: { status: 401, mensagem: 'Usuário ou senha incorretos.' } };
}

export function autorizadoCron(req) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const cabecalho = req.headers.authorization || '';
  const viaBearer = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : '';
  const viaQuery = new URL(req.url, 'http://x').searchParams.get('chave') || '';
  return iguais(viaBearer, esperado) || iguais(viaQuery, esperado);
}

/** Lê o corpo como JSON, funcione ou não o parser automático da plataforma. */
export async function lerJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};

  const partes = [];
  for await (const parte of req) partes.push(parte);
  const texto = Buffer.concat(partes).toString('utf8');
  return texto ? JSON.parse(texto) : {};
}

/** Envolve um handler para que nenhuma exceção vire um 500 mudo e sem log. */
export function comErros(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      console.error('[erro não tratado]', e);
      if (!res.headersSent) erro(res, 500, e.message || 'Erro interno.');
    }
  };
}
