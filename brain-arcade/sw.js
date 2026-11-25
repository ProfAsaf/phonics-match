// Offline support. Online, every file comes fresh from the network (revalidated, so updates show
// up at once); the copy kept here is used only when the network is missing or slow.
// Bump VERSION on each release.
const VERSION = 'brain-arcade-v4';
const CORE = ['./', 'index.html', 'css/app.css', 'js/app.js'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })))).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await Promise.race([
        fetch(req.url, { cache: 'no-cache' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), 4000)),
      ]);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('index.html')) || Response.error();
    }
  })());
});
