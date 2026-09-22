/*
 * Service worker: o app precisa abrir sem sinal (prédio de consultório, elevador).
 * Estratégia: cache-first para a casca e a base de médicos, com atualização em
 * segundo plano. Subir o número da versão troca o cache inteiro.
 */
const VERSAO = "medicos-v1";
const CASCA = [
  "./",
  "./index.html",
  "./estilo.css",
  "./app.js",
  "./medicos.json",
  "./manifest.webmanifest",
  "./icone.svg",
  "./favicon.png",
  "./icone-180.png",
  "./icone-192.png",
  "./icone-512.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(CASCA)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((nome) => nome !== VERSAO).map((nome) => caches.delete(nome))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET" || new URL(pedido.url).origin !== self.location.origin) return;

  evento.respondWith(
    caches.match(pedido).then((guardado) => {
      const rede = fetch(pedido)
        .then((resposta) => {
          if (resposta && resposta.ok) {
            const copia = resposta.clone();
            caches.open(VERSAO).then((cache) => cache.put(pedido, copia));
          }
          return resposta;
        })
        .catch(() => guardado || caches.match("./index.html"));
      return guardado || rede;
    })
  );
});
