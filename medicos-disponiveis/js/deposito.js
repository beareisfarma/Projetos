/*
 * Depósito local (IndexedDB).
 *
 * É a cópia de trabalho do app: tudo é lido e escrito aqui primeiro, e só
 * depois empurrado para a nuvem. É isso que faz o app funcionar em corredor de
 * consultório sem sinal — a rede é um detalhe de sincronização, não o caminho
 * crítico de marcar uma visita.
 *
 * Uma base de médicos passa fácil de 200 KB, e o localStorage tem cota apertada
 * e é síncrono; daí IndexedDB. A sessão (token) fica no localStorage de
 * propósito: é pequena, precisa ser lida antes de tudo e some junto com o site.
 */

const BANCO = "medicos-disponiveis";
const VERSAO = 1;
const LOJA = "dados";
const CHAVE_SESSAO = "medicos:sessao";

let conexao = null;

function abrir() {
  if (conexao) return conexao;
  conexao = new Promise((resolver, rejeitar) => {
    if (!globalThis.indexedDB) {
      rejeitar(new Error("IndexedDB indisponível"));
      return;
    }
    const pedido = indexedDB.open(BANCO, VERSAO);
    pedido.onupgradeneeded = () => {
      const bd = pedido.result;
      if (!bd.objectStoreNames.contains(LOJA)) bd.createObjectStore(LOJA);
    };
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rejeitar(pedido.error);
    pedido.onblocked = () => rejeitar(new Error("IndexedDB bloqueado"));
  });
  return conexao;
}

async function transacao(modo, tarefa) {
  const bd = await abrir();
  return new Promise((resolver, rejeitar) => {
    const tx = bd.transaction(LOJA, modo);
    const loja = tx.objectStore(LOJA);
    let resultado;
    try {
      resultado = tarefa(loja);
    } catch (erro) {
      rejeitar(erro);
      return;
    }
    // Chave ausente devolve um IDBRequest com result undefined. Sem desembrulhar
    // explicitamente, o próprio objeto de requisição vazava como valor — e ele é
    // "verdadeiro", então uma base inexistente passava por base carregada.
    tx.oncomplete = () => {
      if (resultado && typeof IDBRequest !== "undefined" && resultado instanceof IDBRequest) {
        resolver(resultado.result === undefined ? null : resultado.result);
        return;
      }
      resolver(resultado ?? null);
    };
    tx.onerror = () => rejeitar(tx.error);
    tx.onabort = () => rejeitar(tx.error);
  });
}

export async function ler(chave) {
  try {
    const valor = await transacao("readonly", (loja) => loja.get(chave));
    return valor ?? null;
  } catch {
    return null;
  }
}

export async function guardar(chave, valor) {
  try {
    await transacao("readwrite", (loja) => loja.put(valor, chave));
    return true;
  } catch {
    return false;
  }
}

export async function apagar(chave) {
  try {
    await transacao("readwrite", (loja) => loja.delete(chave));
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------- sessão */

// Navegação privada e armazenamento bloqueado lançam exceção já na leitura.
// Sem guarda aqui, o app não chega nem a desenhar a tela de login.
export function lerSessao() {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSAO);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

export function guardarSessao(sessao) {
  try {
    if (sessao) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
    else localStorage.removeItem(CHAVE_SESSAO);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------ teste de disponibilidade */

export async function funciona() {
  const marca = `teste-${Date.now()}`;
  if (!(await guardar("__teste", marca))) return false;
  const lido = await ler("__teste");
  await apagar("__teste");
  return lido === marca;
}
