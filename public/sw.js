const CACHE_NAME = 'smart-minds-shell-v2-brand-20261119';
const APP_ROOT = '/smart-minds/';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([APP_ROOT, APP_ROOT + 'index.html'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(APP_ROOT + 'icons/')) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
    return;
  }
  if (request.mode === 'navigate' && url.pathname.startsWith(APP_ROOT)) {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(APP_ROOT + 'index.html', response.clone()));
      return response;
    }).catch(() => caches.match(APP_ROOT + 'index.html')));
  }
});