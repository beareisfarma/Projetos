// Um Redis REST falso, em memória, que fala o subconjunto de comandos que o
// store.js usa. Deixa o fluxo inteiro ser testado sem serviço externo.
import { createServer } from 'node:http';
import { createServer as criarServidorTLS } from 'node:https';
import { readFileSync } from 'node:fs';

export function bancoFalso(contasIniciais = {}) {
  const tabelas = {
    lembretes: new Map(), avisos_fila: new Map(), push_inscricoes: new Map(), usuarios: new Map(),
  };
  const contas = new Map(Object.entries(contasIniciais));
  // A senha mora em `contas` (como o hash mora fora do alcance da API no banco
  // real); a linha de `usuarios` guarda só o que a API pode ler e escrever.
  // resumo_hora nasce NULL aqui de propósito, ao contrário do banco real, onde o
  // default é 7: assim o resumo diário não dispara no meio dos outros testes e
  // bagunça a contagem de pushes. Quem testa resumo liga explicitamente.
  for (const usuario of contas.keys()) {
    tabelas.usuarios.set(usuario, { usuario, assistente: null, resumo_hora: null, resumo_em: null });
  }
  const chaveFila = (r) => `${r.lembrete_id}#${r.chave}`;
  const chavePrimaria = (tabela, r) =>
    tabela === 'avisos_fila' ? chaveFila(r) : tabela === 'usuarios' ? r.usuario : r.id;

  // Só os filtros que o store.js realmente emite: id=eq.X, status=eq.Y,
  // lembrete_id=eq.Z. Se aparecer um operador novo, o teste falha alto em vez
  // de fingir que filtrou.
  /** Um dos poucos testes de coluna do PostgREST: eq, lt, is.null e not.is.null. */
  function casa(linha, campo, bruto) {
    const [op, valor] = String(bruto).split(/\.(.+)/);
    if (op === 'eq') return String(linha[campo]) === valor;
    if (op === 'lt') return linha[campo] !== null && linha[campo] !== undefined
                         && String(linha[campo]) < valor;
    if (op === 'is') return valor === 'null'
      ? (linha[campo] === null || linha[campo] === undefined)
      : String(linha[campo]) === valor;
    if (op === 'not') return !casa(linha, campo, valor);
    throw new Error(`operador não implementado no falso: ${campo}=${bruto}`);
  }

  function filtrar(tabela, params) {
    let linhas = [...tabelas[tabela].values()];
    for (const [campo, bruto] of params.entries()) {
      if (['select', 'order', 'limit', 'offset'].includes(campo)) continue;
      // or=(a.is.null,b.lt.X) — basta uma das condições valer.
      if (campo === 'or') {
        const partes = String(bruto).replace(/^\(|\)$/g, '').split(',');
        linhas = linhas.filter((r) => partes.some((cond) => {
          const [c, ...resto] = cond.split('.');
          return casa(r, c, resto.join('.'));
        }));
        continue;
      }
      linhas = linhas.filter((r) => casa(r, campo, bruto));
    }
    const ordem = params.get('order');
    if (ordem) {
      const [campo, dir] = ordem.split('.');
      linhas.sort((a, b) => {
        const x = a[campo], y = b[campo];
        const cmp = x === y ? 0 : (x ?? '') < (y ?? '') ? -1 : 1;
        return dir === 'desc' ? -cmp : cmp;
      });
    }
    const limite = params.get('limit');
    return limite ? linhas.slice(0, Number(limite)) : linhas;
  }

  const servidor = createServer(async (req, res) => {
    const partes = [];
    for await (const p of req) partes.push(p);
    const corpo = partes.length ? JSON.parse(Buffer.concat(partes).toString('utf8')) : null;
    const url = new URL(req.url, 'http://x');
    const caminho = url.pathname.replace('/rest/v1', '');
    res.setHeader('Content-Type', 'application/json');

    try {
      // Autenticação: contas em memória, com o mesmo contrato da função do banco.
      if (caminho === '/rpc/autenticar_acesso') {
        const conta = contas.get(corpo.p_usuario);
        const ok = Boolean(conta) && conta === corpo.p_senha;
        res.end(JSON.stringify([{
          permitido: ok, usuario: ok ? corpo.p_usuario : null, bloqueado_ate: null, erros: ok ? 0 : 1,
        }]));
        return;
      }

      // Troca de senha: mesmo contrato da função do banco, inclusive a ordem
      // das recusas (tamanho antes de conferir a senha atual).
      if (caminho === '/rpc/trocar_senha') {
        const atualDaConta = contas.get(corpo.p_usuario);
        let resposta;
        if (!corpo.p_nova || String(corpo.p_nova).length < 6) resposta = { ok: false, motivo: 'curta' };
        else if (atualDaConta === undefined || atualDaConta !== corpo.p_atual) {
          resposta = { ok: false, motivo: 'atual' };
        } else {
          contas.set(corpo.p_usuario, corpo.p_nova);
          resposta = { ok: true, motivo: null };
        }
        res.end(JSON.stringify([resposta]));
        return;
      }

      // A função que pega e remove os avisos vencidos, no mesmo passo.
      if (caminho === '/rpc/pegar_avisos_vencidos') {
        const agora = Date.now();
        const vencidos = [...tabelas.avisos_fila.values()]
          .filter((r) => Date.parse(r.disparar_em) <= agora)
          .sort((a, b) => Date.parse(a.disparar_em) - Date.parse(b.disparar_em))
          .slice(0, corpo?.limite ?? 50);
        for (const r of vencidos) tabelas.avisos_fila.delete(chaveFila(r));
        res.end(JSON.stringify(vencidos));
        return;
      }

      const tabela = caminho.slice(1);
      if (!tabelas[tabela]) throw new Error(`tabela desconhecida: ${tabela}`);

      if (req.method === 'GET') { res.end(JSON.stringify(filtrar(tabela, url.searchParams))); return; }

      if (req.method === 'POST') {
        const linhas = Array.isArray(corpo) ? corpo : [corpo];
        const upsert = String(req.headers.prefer || '').includes('merge-duplicates');
        for (const linha of linhas) {
          const k = chavePrimaria(tabela, linha);
          if (tabelas[tabela].has(k) && !upsert) throw new Error('chave duplicada');
          tabelas[tabela].set(k, { ...(tabelas[tabela].get(k) || {}), ...linha });
        }
        res.statusCode = 201; res.end(''); return;
      }

      if (req.method === 'PATCH') {
        const tocadas = [];
        for (const linha of filtrar(tabela, url.searchParams)) {
          const nova = { ...linha, ...corpo };
          tabelas[tabela].set(chavePrimaria(tabela, linha), nova);
          tocadas.push(nova);
        }
        // Prefer: return=representation devolve o que mudou — é assim que o
        // store sabe se a marcação do resumo pegou ou se outro tick chegou antes.
        if (String(req.headers.prefer || '').includes('return=representation')) {
          res.statusCode = 200; res.end(JSON.stringify(tocadas)); return;
        }
        res.statusCode = 204; res.end(''); return;
      }

      if (req.method === 'DELETE') {
        for (const linha of filtrar(tabela, url.searchParams)) {
          tabelas[tabela].delete(chavePrimaria(tabela, linha));
          // ON DELETE CASCADE da fila
          if (tabela === 'lembretes') {
            for (const [k, f] of tabelas.avisos_fila) if (f.lembrete_id === linha.id) tabelas.avisos_fila.delete(k);
          }
        }
        res.statusCode = 204; res.end(''); return;
      }

      res.statusCode = 405; res.end('{}');
    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ message: e.message }));
    }
  });

  return {
    async subir() {
      await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
      return `http://127.0.0.1:${servidor.address().port}`;
    },
    parar: () => new Promise((ok) => servidor.close(ok)),
    espiar: tabelas,
    contas,
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
