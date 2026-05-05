const CACHE = 'zeiterfassung-v2';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json', './icon.svg', './config.js'];

// Never cache Firebase CDN or Firestore API calls
const NO_CACHE = ['gstatic.com', 'firebaseio.com', 'firestore.googleapis.com', 'googleapis.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Let Firebase/network requests pass through untouched
  if (NO_CACHE.some(h => url.includes(h))) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Cache-first for app assets
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res && res.status === 200 && e.request.method === 'GET') {
        var clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});
