/**
 * Service worker: o app abre sem internet.
 *
 * Um representante monta o relatório no carro, no corredor da farmácia, no
 * consultório. Tudo que a ferramenta precisa (inclusive o pdf.js e o gerador
 * de PDF) está no próprio domínio e entra no cache na instalação.
 *
 * As rotas /api/* nunca são cacheadas: são as chamadas opcionais de IA, que
 * ou funcionam online ou falham e a tela segue com a leitura local.
 */

const CACHE = 'r2d-relatorio-v2';

const ESSENCIAL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'css/relatorio.css',
  'js/app.js',
  'js/estado.js',
  'js/db.js',
  'js/ui.js',
  'js/marca.js',
  'js/graficos.js',
  'js/fotos.js',
  'js/ia.js',
  'js/extrator.js',
  'js/pdf-leitor.js',
  'js/relatorio.js',
  'js/exportar.js',
  'js/telas/inicio.js',
  'js/telas/acoes.js',
  'js/telas/indicadores.js',
  'js/telas/previa.js',
  'fonts/source-sans-3-latin-400-normal.woff2',
  'fonts/source-sans-3-latin-600-normal.woff2',
  'fonts/source-sans-3-latin-700-normal.woff2',
  'vendor/pdf.min.mjs',
  'vendor/pdf.worker.min.mjs',
  'vendor/html2canvas.min.js',
  'vendor/jspdf.umd.min.js',
  'icons/icone-192.png',
  'icons/icone-512.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll falha inteiro se um arquivo faltar; um a um degrada em vez de quebrar
    await Promise.all(ESSENCIAL.map((url) => cache.add(url).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;

  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  evento.respondWith((async () => {
    const guardado = await caches.match(pedido, { ignoreSearch: false });
    if (guardado) {
      // atualiza em segundo plano, serve o que já tem
      fetch(pedido).then((r) => {
        if (r.ok) caches.open(CACHE).then((c) => c.put(pedido, r.clone()));
      }).catch(() => {});
      return guardado;
    }
    try {
      const resposta = await fetch(pedido);
      if (resposta.ok) {
        const cache = await caches.open(CACHE);
        cache.put(pedido, resposta.clone());
      }
      return resposta;
    } catch {
      const alternativa = await caches.match('index.html');
      if (alternativa && pedido.mode === 'navigate') return alternativa;
      throw new Error('offline e sem cópia local');
    }
  })());
});
