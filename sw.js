// Offline support: the app shell is cached on install; news is network-first with a cached fallback;
// fonts are cached the first time they load. The AI coach and Google sign-in always need the network.
const VERSION = 'speakdaily-v1.1.0';
const SHELL = [
  '/', '/index.html', '/css/app.css', '/manifest.webmanifest',
  '/js/app.js', '/js/store.js', '/js/content.js', '/js/drive.js', '/js/voice.js', '/js/audio.js', '/js/content-extra.js',
  '/icons/icon-192.png', '/icons/icon.svg', '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fonts: cache first.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;

  // News and config: network first, fall back to the last saved copy.
  if (url.pathname === '/api/feed' || url.pathname === '/api/config') {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req).then((r) => r || new Response('{}', { headers: { 'content-type': 'application/json' } }))));
    return;
  }
  if (url.pathname.startsWith('/api/')) return;

  // Pages: serve the cached app (works offline), refresh it in the background.
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('/index.html').then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok) caches.open(VERSION).then((c) => c.put('/index.html', res.clone())); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  // Static files: cache first, then network (stale-while-revalidate).
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((res) => { if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone())); return res; }).catch(() => hit);
    return hit || net;
  }));
});
