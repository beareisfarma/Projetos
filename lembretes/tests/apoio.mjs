// Um Redis REST falso, em memória, que fala o subconjunto de comandos que o
// store.js usa. Deixa o fluxo inteiro ser testado sem serviço externo.
import { createServer } from 'node:http';
import { createServer as criarServidorTLS } from 'node:https';
import { readFileSync } from 'node:fs';

export function redisFalso() {
  const strings = new Map();
  const zsets = new Map();   // chave -> Map(membro -> score)
  const hashes = new Map();  // chave -> Map(campo -> valor)

  const zset = (k) => zsets.get(k) || zsets.set(k, new Map()).get(k);
  const hash = (k) => hashes.get(k) || hashes.set(k, new Map()).get(k);
  const ordenado = (k) => [...zset(k).entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));

  function executar(partes) {
    const [bruto, ...args] = partes;
    const cmd = String(bruto).toUpperCase();
    switch (cmd) {
      case 'SET': strings.set(args[0], args[1]); return 'OK';
      case 'GET': return strings.get(args[0]) ?? null;
      case 'MGET': return args.map((k) => strings.get(k) ?? null);
      case 'DEL': { const t = strings.delete(args[0]); return t ? 1 : 0; }
      case 'ZADD': zset(args[0]).set(String(args[2]), Number(args[1])); return 1;
      case 'ZREM': return zset(args[0]).delete(String(args[1])) ? 1 : 0;
      case 'ZRANGE': {
        const [chave, ini, fim, ...resto] = args;
        const sinal = resto.map((r) => String(r).toUpperCase());
        let itens = ordenado(chave);
        if (sinal.includes('BYSCORE')) {
          itens = itens.filter(([, s]) => s >= Number(ini) && s <= Number(fim));
          const i = sinal.indexOf('LIMIT');
          if (i >= 0) {
            const desloc = Number(resto[i + 1]), quantos = Number(resto[i + 2]);
            itens = itens.slice(desloc, quantos < 0 ? undefined : desloc + quantos);
          }
        } else {
          if (sinal.includes('REV')) itens = itens.reverse();
          const total = itens.length;
          const a = Number(ini) < 0 ? total + Number(ini) : Number(ini);
          const b = Number(fim) < 0 ? total + Number(fim) : Number(fim);
          itens = itens.slice(a, b + 1);
        }
        return itens.map(([m]) => m);
      }
      case 'HSET': hash(args[0]).set(args[1], args[2]); return 1;
      case 'HGETALL': return Object.fromEntries(hash(args[0]));
      case 'HDEL': return hash(args[0]).delete(args[1]) ? 1 : 0;
      default: throw new Error(`comando não implementado no falso: ${cmd}`);
    }
  }

  const servidor = createServer(async (req, res) => {
    const partes = [];
    for await (const p of req) partes.push(p);
    const corpo = JSON.parse(Buffer.concat(partes).toString('utf8'));
    res.setHeader('Content-Type', 'application/json');
    try {
      if (req.url.startsWith('/pipeline')) {
        res.end(JSON.stringify(corpo.map((c) => ({ result: executar(c) }))));
      } else {
        res.end(JSON.stringify({ result: executar(corpo) }));
      }
    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: e.message }));
    }
  });

  return {
    async subir() {
      await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
      return `http://127.0.0.1:${servidor.address().port}`;
    },
    parar: () => new Promise((ok) => servidor.close(ok)),
    espiar: { strings, zsets, hashes },
  };
}

/**
 * Serviço de push falso. O web-push só fala HTTPS, então este sobe com o
 * certificado que o runner emitiu (scripts/testar.mjs) e que foi adicionado às
 * CAs confiáveis do processo — a verificação de TLS continua ligada.
 */
export const pushDisponivel = () => Boolean(process.env.TLS_CERT && process.env.TLS_CHAVE);

export function pushFalso() {
  const recebidas = [];
  const credenciais = {
    cert: readFileSync(process.env.TLS_CERT),
    key: readFileSync(process.env.TLS_CHAVE),
  };
  const servidor = criarServidorTLS(credenciais, async (req, res) => {
    const partes = [];
    for await (const p of req) partes.push(p);
    recebidas.push({ caminho: req.url, bytes: Buffer.concat(partes).length, headers: req.headers });
    res.statusCode = 201;
    res.end();
  });
  return {
    recebidas,
    async subir() {
      await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
      return `https://127.0.0.1:${servidor.address().port}/push`;
    },
    parar: () => new Promise((ok) => servidor.close(ok)),
  };
}

/** req/res de mentira, compatíveis com o que os handlers usam. */
export function fingirRequisicao({ method = 'GET', url = '/', headers = {}, body }) {
  return { method, url, headers, body };
}

export function fingirResposta() {
  const r = {
    codigo: 200, cabecalhos: {}, corpo: null, headersSent: false,
    status(c) { r.codigo = c; return r; },
    setHeader(k, v) { r.cabecalhos[k] = v; return r; },
    end(texto) { r.headersSent = true; r.corpo = texto ? JSON.parse(texto) : null; return r; },
  };
  return r;
}
