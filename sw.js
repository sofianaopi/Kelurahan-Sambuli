/* Service worker: membuat aplikasi tetap terbuka walau sinyal hilang */
const CACHE = 'skp-harian-v4';
const FILES = ['./', 'index.html', 'input.html', 'admin.html', 'config.js', 'common.js', 'template-bukti-dukung.docx', 'docx.js', 'manifest-input.json', 'manifest-dashboard.json',
  'icons/input-192.png', 'icons/input-512.png', 'icons/dashboard-192.png', 'icons/dashboard-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // Hanya berkas aplikasi & pustaka CDN yang disimpan; data database selalu langsung ke server
  if (e.request.method !== 'GET' || (u.origin !== location.origin && u.hostname !== 'cdn.jsdelivr.net')) return;
  // Jaringan dulu (agar pembaruan cepat terpakai), cache bila offline
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
