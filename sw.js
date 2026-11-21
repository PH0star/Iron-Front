// Change the release key whenever a precached resource changes.
const root = self.registration.scope;
const prefix = 'iron-front:' + root + ':';
const cacheName = prefix + '2.0.0-beta.2';
const files = [
  'index.html', 'style.css', 'game.js', 'engine.js', 'terrain.js', 'sprites.js',
  'sound.js', 'icons.js', 'pwa.js', 'duel.css', 'duel.js', 'duel-config.js', 'vendor/qrcode.js', 'manifest.webmanifest', 'VERSION',
  'assets/insignia-blue.svg','assets/insignia.svg', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png'
];
const urls = new Set(files.map(file => new URL(file, root).href));
const entry = new URL('index.html', root).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll([...urls].map(url => new Request(url, {cache: 'reload'})))
  ));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(prefix) && key !== cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  url.search = '';
  const navigation = request.mode === 'navigate' && (url.href === root || url.href === entry);
  if (!navigation && !urls.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(navigation ? entry : url.href) || fetch(request);
  })());
});
