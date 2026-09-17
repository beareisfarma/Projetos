/**
 * Armazenamento local (IndexedDB).
 *
 * Não há login, então tudo mora no navegador deste aparelho. Duas lojas:
 *  - `projeto`: o relatório em edição (um objeto, chave fixa 'atual')
 *  - `fotos`:   os Blobs das evidências, por id
 *
 * As fotos ficam separadas de propósito. Guardar foto em base64 dentro do
 * objeto do projeto estoura a cota do localStorage no terceiro registro e
 * deixa cada gravação lenta — o Blob no IndexedDB não tem esse problema.
 */

const NOME = 'r2d-relatorio';
const VERSAO = 1;
let promessaDb = null;

function abrir() {
  if (promessaDb) return promessaDb;
  promessaDb = new Promise((ok, erro) => {
    const req = indexedDB.open(NOME, VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projeto')) db.createObjectStore('projeto');
      if (!db.objectStoreNames.contains('fotos')) db.createObjectStore('fotos');
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
  return promessaDb;
}

async function transacao(loja, modo, acao) {
  const db = await abrir();
  return new Promise((ok, erro) => {
    const tx = db.transaction(loja, modo);
    const req = acao(tx.objectStore(loja));
    tx.oncomplete = () => ok(req ? req.result : undefined);
    tx.onerror = () => erro(tx.error);
    tx.onabort = () => erro(tx.error);
  });
}

export const db = {
  lerProjeto: () => transacao('projeto', 'readonly', (l) => l.get('atual')),
  gravarProjeto: (p) => transacao('projeto', 'readwrite', (l) => l.put(p, 'atual')),
  apagarProjeto: () => transacao('projeto', 'readwrite', (l) => l.delete('atual')),

  lerFoto: (id) => transacao('fotos', 'readonly', (l) => l.get(id)),
  gravarFoto: (id, blob) => transacao('fotos', 'readwrite', (l) => l.put(blob, id)),
  apagarFoto: (id) => transacao('fotos', 'readwrite', (l) => l.delete(id)),
  idsDeFotos: () => transacao('fotos', 'readonly', (l) => l.getAllKeys()),
  limparFotos: () => transacao('fotos', 'readwrite', (l) => l.clear()),
};

/* --- cache de URLs de objeto ------------------------------------------- */
/* Um createObjectURL por foto, reaproveitado. Sem isso, cada redesenho da
   timeline cria URLs novas e o navegador segura todas as fotos na memória. */
const urls = new Map();

export async function urlDaFoto(id) {
  if (urls.has(id)) return urls.get(id);
  const blob = await db.lerFoto(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(id, url);
  return url;
}

export function esquecerFoto(id) {
  const url = urls.get(id);
  if (url) { URL.revokeObjectURL(url); urls.delete(id); }
}

/** Blob → data: URL. O html2canvas não mancha o canvas com blob: do mesmo
 *  domínio, mas data: é o único caminho que também sobrevive ao clone do DOM
 *  feito na exportação. */
export function comoDataUrl(blob) {
  return new Promise((ok, erro) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(leitor.result);
    leitor.onerror = () => erro(leitor.error);
    leitor.readAsDataURL(blob);
  });
}
