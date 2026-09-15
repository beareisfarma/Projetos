// Utilidades comuns aos endpoints: resposta JSON, leitura de corpo e as duas
// portas de autenticação (o PIN da dona do app e o segredo do cron).
import { timingSafeEqual } from 'node:crypto';

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
 * O app é de uma pessoa só, mas fica numa URL pública: sem esta porta qualquer
 * um que descubra o endereço escreve no banco e dispara notificações.
 */
export function autorizado(req) {
  const esperado = process.env.APP_PIN;
  if (!esperado) return false; // sem PIN configurado, nada é liberado
  const enviado = req.headers['x-lembretes-pin'];
  return iguais(enviado, esperado);
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
