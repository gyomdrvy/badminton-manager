const SCOPE = new URL(self.registration.scope);
const PREFIX = 'gyomdrvy-pwa:' + SCOPE.pathname + ':';
const CACHE = PREFIX + (new URL(self.location.href).searchParams.get('release') ?? BUILD);
self.addEventListener('install', event => {
  const requests = ASSETS.map(path => new Request(new URL(path, SCOPE), {cache:'reload'}));
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(requests)));
});
self.addEventListener('message', event => {
  if (event.data === 'APPLY_UPDATE') event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  // Release checks must reach the server even while the old version controls this page.
  if (request.cache === 'no-store') return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const path = request.mode === 'navigate' && url.pathname === SCOPE.pathname ? './index.html' : request;
    return (await cache.match(path)) ?? fetch(request);
  }));
});
