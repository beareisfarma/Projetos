/*
 * Service worker: o app precisa abrir sem sinal (prédio de consultório, elevador).
 * Estratégia: cache-first para a casca e a base de médicos, com atualização em
 * segundo plano. Subir o número da versão troca o cache inteiro.
 */
const VERSAO = "medicos-v8";
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

// `cache.addAll` usa o cache HTTP do navegador. Com Cache-Control longo nos
// arquivos, a versão nova do service worker enchia o cache NOVO com os arquivos
// VELHOS que o navegador já tinha guardado — o número da versão subia e o app
// continuava o mesmo. Reproduzido num navegador de verdade em 23/09/2026.
// `cache: "reload"` obriga cada arquivo da casca a vir da rede.
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(VERSAO)
      .then((cache) => cache.addAll(CASCA.map((caminho) => new Request(caminho, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
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

  // Só o cache DESTA versão: `caches.match` sem `cacheName` varre todos os
  // caches da origem, então um arquivo de uma versão anterior ainda podia ser
  // servido enquanto o cache velho não tivesse sido apagado.
  evento.respondWith(
    caches.open(VERSAO).then((cache) => cache.match(pedido)).then((guardado) => {
      const rede = fetch(pedido)
        .then((resposta) => {
          if (resposta && resposta.ok) {
            const copia = resposta.clone();
            caches.open(VERSAO).then((cache) => cache.put(pedido, copia));
          }
          return resposta;
        })
        .catch(() => guardado || caches.open(VERSAO).then((cache) => cache.match("./index.html")));
      return guardado || rede;
    })
  );
});
