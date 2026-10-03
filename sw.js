// Offline play from the home screen (SPEC.md, "Technical requirements"): caches the whole game and
// every recorded clip in audio/manifest.json. Bump VERSION on each release so phones pick it up.
const VERSION = 5;
const CACHE = `phonics-v${VERSION}`;
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/game.css',
  'js/activities.js', 'js/app.js', 'js/audio.js', 'js/choose.js', 'js/clipstore.js', 'js/config.js', 'js/content.js',
  'js/mastery.js', 'js/mic.js', 'js/music.js', 'js/parent.js', 'js/recorder.js', 'js/rng.js', 'js/session.js', 'js/stats.js',
  'js/storage.js', 'js/takes.js', 'js/ui.js', 'js/voices.js',
  'content/sounds.json', 'content/levels.json', 'content/words.json', 'content/nonsense.json',
  'content/sentences.json', 'content/prompts.json', 'content/custom-sentences.json',
  'audio/manifest.json', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES);
    const manifest = await (await fetch('audio/manifest.json', { cache: 'no-store' })).json();
    await cache.addAll(Object.values(manifest.clips ?? {}).map(file => `audio/${file}`));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

// Cache first; anything new from the network is kept for next time.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      return (await cache.match('index.html')) ?? Response.error();
    }
  })());
});
