/*
 * Service worker: o app precisa abrir sem sinal (prédio de consultório, elevador).
 * Estratégia: cache-first para a casca e a base de médicos, com atualização em
 * segundo plano. Subir o número da versão troca o cache inteiro.
 */
const VERSAO = "medicos-v4";
const CASCA = [
  "./",
  "./index.html",
  "./estilo.css",
  "./config.js",
  "./js/app.js",
  "./js/dados.js",
  "./js/deposito.js",
  "./js/importar.js",
  "./js/nuvem.js",
  "./js/utilidades.js",
  "./vendor/fflate-0.8.3.min.js",
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
  const endereco = new URL(pedido.url);
  // Só a própria origem entra no cache: chamadas ao Supabase precisam ir à rede
  // sempre, e uma resposta de API guardada seria dado velho fingindo ser novo.
  if (pedido.method !== "GET" || endereco.origin !== self.location.origin) return;

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
