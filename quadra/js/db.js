/**
 * Guarda os dados no IndexedDB do próprio navegador.
 *
 * O estado inteiro é gravado como um objeto só. Numa escolinha de 100 atletas
 * com dois anos de histórico isso dá algumas centenas de KB — não compensa a
 * complexidade de uma transação por tabela, e gravar tudo de uma vez tem uma
 * vantagem real: ou o estado salva inteiro, ou não salva. Nunca meio.
 *
 * A contrapartida é séria e está dita no README: os dados vivem NAQUELE
 * navegador. Limpar dados do site apaga tudo. Por isso Backup e Restaurar não
 * são enfeite — são a única rede de segurança enquanto não houver servidor.
 */
const BANCO = 'quadra';
const DEPOSITO = 'estado';
const CHAVE = 'atual';

let conexao = null;

function abrir() {
  if (conexao) return Promise.resolve(conexao);
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => {
      if (!pedido.result.objectStoreNames.contains(DEPOSITO)) {
        pedido.result.createObjectStore(DEPOSITO);
      }
    };
    pedido.onsuccess = () => { conexao = pedido.result; resolve(conexao); };
    pedido.onerror = () => reject(pedido.error);
  });
}

async function transacao(modo, acao) {
  const bd = await abrir();
  return new Promise((resolve, reject) => {
    const t = bd.transaction(DEPOSITO, modo);
    const pedido = acao(t.objectStore(DEPOSITO));
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

export const ler = () => transacao('readonly', (dep) => dep.get(CHAVE));
export const gravar = (dados) => transacao('readwrite', (dep) => dep.put(dados, CHAVE));
export const limpar = () => transacao('readwrite', (dep) => dep.delete(CHAVE));

/** O navegador pode descartar o IndexedDB sob pressão de espaço. Isto pede que não descarte. */
export async function pedirPersistencia() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* em aba privada isso lança; não é motivo para derrubar o app */ }
  return false;
}
