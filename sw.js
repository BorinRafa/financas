/* Service worker: guarda o app em cache para funcionar offline.
   Estratégia: com internet, busca sempre a versão mais nova (rede primeiro);
   sem internet, usa o que está em cache. */
const CACHE = 'financas-v3';
const ARQUIVOS = ['./', 'index.html', 'app.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  // cache: 'reload' ignora o cache HTTP do navegador e baixa os arquivos novos do servidor
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // cotações vão direto para a rede
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000); // rede lenta: cai para o cache em 4 s
      const r = await fetch(e.request, { cache: 'no-cache', signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) cache.put(e.request, r.clone());
      return r;
    } catch {
      return (await cache.match(e.request, { ignoreSearch: true })) ||
             (e.request.mode === 'navigate' ? await cache.match('index.html') : Response.error());
    }
  })());
});
