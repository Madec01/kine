'use strict';
// Change this version whenever a precached file changes. A complete new cache
// activates only after every window using the previous version has closed.
const VERSION = '2026-10-23-install-1';
const BASE = self.registration.scope;
const PREFIX = `kine-shell:${new URL(BASE).pathname}:`;
const CACHE = PREFIX + VERSION;
const FILES = [
  './', 'index.html', 'styles.css', 'mobile.css', 'pwa.css',
  'data.js', 'model.js', 'illustrations.js', 'app.js', 'pwa.js',
  'manifest.webmanifest', 'assets/favicon.svg', 'assets/icon-180.png',
  'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png'
];
const URLS = FILES.map(path => new URL(path, BASE).href);

self.addEventListener('install', event => {
  // A failed download leaves the active version intact. No skipWaiting:
  // updates must never reload an exercise being edited.
  event.waitUntil(caches.open(CACHE).then(cache =>
    cache.addAll(URLS.map(url => new Request(url, { cache: 'reload' })))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const home = new URL(BASE);
  const isHome = event.request.mode === 'navigate' && url.origin === home.origin &&
    [home.pathname, home.pathname + 'index.html'].includes(url.pathname);
  // Only this application's known assets are cached. Other GitHub Pages sites,
  // external media and user exports are left to the browser.
  const key = isHome ? BASE : url.href;
  if (!URLS.includes(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match(key)) || fetch(event.request);
  })());
});
