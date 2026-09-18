/**
 * Service worker: o app abre offline.
 *
 * Isso não é luxo — o cenário real é ginásio, quadra de escola e área de praia,
 * onde o 4G cai. A chamada do treino e a consulta da escalação precisam
 * funcionar sem rede; os dados já estão no IndexedDB, o que faltava era a casca.
 *
 * Estratégia: cache-first para o que é estático, com atualização em segundo
 * plano. Trocar a VERSAO derruba o cache antigo.
 */
const VERSAO = 'quadra-v2';

const ARQUIVOS = [
  './',
  './index.html',
  './ver.html',
  './css/app.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/db.js',
  './js/estado.js',
  './js/formato.js',
  './js/modelo.js',
  './js/pix.js',
  './js/cobranca.js',
  './js/exemplo.js',
  './js/rota.js',
  './js/partilha.js',
  './js/ver.js',
  './js/planilha.js',
  './js/ui.js',
  './js/telas/painel.js',
  './js/telas/atletas.js',
  './js/telas/dinheiro.js',
  './js/telas/times.js',
  './js/telas/jogos.js',
  './js/telas/treinos.js',
  './js/telas/ajustes.js',
  './icons/icone-192.png',
  './icons/icone-512.png',
  './icons/icone-180.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(VERSAO);
    // addAll falha inteiro se um arquivo faltar; individual sobrevive a isso.
    await Promise.all(ARQUIVOS.map((a) => cache.add(a).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    for (const chave of await caches.keys()) {
      if (chave !== VERSAO) await caches.delete(chave);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // wa.me e afins passam direto

  evento.respondWith((async () => {
    const guardado = await caches.match(request, { ignoreSearch: true });

    const daRede = fetch(request).then(async (resposta) => {
      if (resposta.ok) {
        const cache = await caches.open(VERSAO);
        cache.put(request, resposta.clone());
      }
      return resposta;
    }).catch(() => null);

    // Offline e sem cache: devolve a casca, que sabe se virar com o IndexedDB.
    return guardado || (await daRede) || caches.match('./index.html');
  })());
});
