/* オフライン用キャッシュ。版を上げると古いキャッシュを削除する。 */
const VERSION = 'mfa-v0.1.1';
const ASSETS = ['./', 'index.html', 'css/app.css', 'js/db.js', 'js/seed.js', 'js/coach.js', 'js/charts.js', 'js/barcode.js', 'js/app.js',
  'vendor/zxing.min.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // 外部API（Open Food Facts）はキャッシュしない
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
