/* Service worker: guarda o app em cache para funcionar offline.
   Ao publicar uma versão nova, aumente o número em CACHE. */
const CACHE = 'financas-v1';
const ARQUIVOS = ['./', 'index.html', 'app.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // cotações vão direto para a rede
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const rede = fetch(e.request).then(r => {
        if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
        return r;
      }).catch(() => hit || caches.match('index.html'));
      return hit || rede;
    })
  );
});
