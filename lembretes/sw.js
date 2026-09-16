// Service worker: casca offline + recepção de push + ações da notificação.
const CACHE = 'assistente-v12';
const CASCA = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

// O PIN fica no IndexedDB porque as ações da notificação ("Feito", "Adiar")
// rodam aqui, com o app fechado, e precisam autenticar na API sozinhas.
const BD = 'lembretes-cfg';
function lerCredenciais() {
  return new Promise((ok) => {
    let req;
    try { req = indexedDB.open(BD, 1); } catch (e) { return ok(null); }
    req.onupgradeneeded = () => req.result.createObjectStore('cfg');
    req.onerror = req.onblocked = () => ok(null);
    req.onsuccess = () => {
      const bd = req.result;
      try {
        const loja = bd.transaction('cfg', 'readonly').objectStore('cfg');
        const lerUsuario = loja.get('usuario');
        const lerPin = loja.get('pin');
        lerPin.onsuccess = () => { ok({ usuario: lerUsuario.result || '', pin: lerPin.result || '' }); bd.close(); };
        lerPin.onerror = () => { ok(null); bd.close(); };
      } catch (e) { bd.close(); ok(null); }
    };
  });
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // A API é de outra origem, então já caiu no teste acima — nunca vem do cache.

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const c = res.clone(); caches.open(CACHE).then((k) => k.put(req, c)); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }
  // Serve do cache e revalida em segundo plano. Antes era só cache: uma vez
  // guardado, um ícone ou uma fonte NUNCA mais atualizava, nem com deploy novo.
  e.respondWith(caches.match(req).then((guardado) => {
    const daRede = fetch(req).then((res) => {
      if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then((k) => k.put(req, c)); }
      return res;
    }).catch(() => guardado);
    return guardado || daRede;
  }));
});

self.addEventListener('push', (e) => {
  let dados = { titulo: 'Lembrete', corpo: 'Você tem um prazo.', dados: {} };
  try { if (e.data) dados = { ...dados, ...e.data.json() }; } catch (_) {
    if (e.data) dados.corpo = e.data.text();
  }
  const id = dados.dados?.id;
  e.waitUntil(self.registration.showNotification(dados.titulo, {
    body: dados.corpo,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: id ? `lembrete-${id}` : undefined,  // um prazo substitui o aviso anterior dele
    renotify: true,
    requireInteraction: true,                 // não some sozinho antes de ela ver
    data: dados.dados || {},
    actions: [
      { action: 'concluir', title: '✅ Feito' },
      { action: 'adiar', title: '⏰ Adiar 1h' },
    ],
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const id = e.notification.data?.id;
  const acao = e.action;

  e.waitUntil((async () => {
    if (id && (acao === 'concluir' || acao === 'adiar')) {
      try {
        const cred = await lerCredenciais();
        const corpo = acao === 'concluir' ? { acao: 'concluir' } : { acao: 'adiar', minutos: 60 };
        const r = await fetch(`https://oyyruucruevoefxzrzpj.supabase.co/functions/v1/api/reminders?id=${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-lembretes-usuario': cred?.usuario || '',
            'x-lembretes-pin': cred?.pin || '',
          },
          body: JSON.stringify(corpo),
        });
        if (!r.ok) throw new Error(String(r.status));
        // Confirma o que aconteceu — ação silenciosa deixa dúvida se funcionou.
        await self.registration.showNotification(
          acao === 'concluir' ? '✅ Marcado como feito' : '⏰ Aviso adiado 1 hora',
          { body: e.notification.body, icon: './icons/icon-192.png', tag: `ok-${id}` });
        const abertos = await self.clients.matchAll({ type: 'window' });
        for (const c of abertos) c.postMessage({ tipo: 'atualizar' });
        return;
      } catch (_) {
        await self.registration.showNotification('Não consegui atualizar', {
          body: 'Abra o app para marcar manualmente.', icon: './icons/icon-192.png',
        });
        return;
      }
    }
    const abertos = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abertos) if ('focus' in c) { c.postMessage({ tipo: 'atualizar' }); return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow('./');
  })());
});
