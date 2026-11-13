/* Service worker: membuat aplikasi tetap terbuka walau sinyal hilang */
const CACHE = 'sakti-v57';
const FILES = ['./', 'index.html', 'input.html', 'admin.html', 'pimpinan.html', 'kuis.html', 'kuis-admin.js', 'vendor/qrcode.min.js', 'config.js', 'common.js', 'template-bukti-dukung.docx', 'excel.js', 'vendor/xlsx.full.min.js', 'template/Template_Input_Kegiatan_SKP_Harian.xlsx', 'template/Template_Daftar_Pegawai_SKP_Harian.xlsx', 'template/Template_RK_IKI_SKP_Harian.xlsx', 'rkpicker.js', 'dinas.js', 'template-laporan-dinas.docx', 'docx.js', 'manifest-input.json', 'manifest-dashboard.json',
  'icons/input-192.png', 'icons/input-512.png', 'icons/dashboard-192.png', 'icons/dashboard-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png', 'img/login-sakti.jpg', 'img/logo-bps.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // Hanya berkas aplikasi & pustaka CDN yang disimpan; data database selalu langsung ke server
  if (e.request.method !== 'GET' || (u.origin !== location.origin && u.hostname !== 'cdn.jsdelivr.net')) return;
  // Jaringan dulu & selalu cek versi terbaru ke server (bukan cache browser), cache bila offline
  const req = u.origin === location.origin ? new Request(e.request, { cache: 'no-cache' }) : e.request;
  e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
