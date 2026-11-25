/* SKP Harian — lapisan data (database Supabase), login, & utilitas bersama */
(function () {
  'use strict';
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const CFG = window.SKP_CONFIG || {};
  const BUCKET = 'bukti';
  const BIDANG = ['Sosial', 'Distribusi', 'Produksi', 'Nerwilis', 'IPDS', 'TU'];

  /* ---------- Koneksi ---------- */
  let sb = null, uid = null, saya = null;
  const siap = () => CFG.SUPABASE_URL && /^https?:\/\//.test(CFG.SUPABASE_URL) && CFG.SUPABASE_ANON_KEY && !/^ISI_/.test(CFG.SUPABASE_ANON_KEY) && window.supabase;
  function client() {
    if (!sb) sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'skp-harian-auth' } });
    return sb;
  }
  const emailDariNip = nip => String(nip || '').toLowerCase().replace(/[^a-z0-9._-]/g, '') + '@' + (CFG.EMAIL_DOMAIN || 'pegawai.skpharian.id');
  function cek(res, pesan) {
    if (res.error) {
      const m = res.error.message || String(res.error);
      const e = new Error(/JWT|token/i.test(m) ? 'Sesi berakhir, silakan masuk lagi.' : /row-level security/i.test(m) ? 'Tidak diizinkan oleh aturan akses.' : (pesan ? pesan + ': ' : '') + m);
      e.asli = res.error; throw e;
    }
    return res.data;
  }

  /* ---------- Pemetaan baris database <-> objek aplikasi ---------- */
  const keK = r => ({ id: r.id, tanggal: r.tanggal, jam: r.jam || '', teks: r.teks || '', bidang: r.bidang || null, jenisId: r.jenis_id || null, rhkId: r.rk_id || null, jumlah: r.jumlah || 1, fotoIds: Array.isArray(r.foto) ? r.foto : [], dibuat: Number(r.dibuat) || 0 });
  const dariK = k => ({ id: k.id, user_id: uid, tanggal: k.tanggal, jam: k.jam || null, teks: k.teks || '', bidang: k.bidang || null, jenis_id: k.jenisId || null, rk_id: k.rhkId || null, jumlah: Math.max(1, parseInt(k.jumlah) || 1), foto: k.fotoIds || [], dibuat: k.dibuat || Date.now() });
  const keR = r => ({ id: r.id, nama: r.nama || '', indikator: r.indikator || '', satuan: r.satuan || '', target: Number(r.target) || 0, targetBulan: r.target_bulan || {}, urutan: r.urutan || 0 });
  const dariR = r => ({ id: r.id, user_id: uid, nama: r.nama || '', indikator: r.indikator || null, satuan: r.satuan || null, target: Number(r.target) || 0, target_bulan: r.targetBulan || {}, urutan: r.urutan || 0 });
  const keJ = r => ({ id: r.id, bidang: r.bidang, nama: r.nama, urutan: r.urutan || 0, dibuatOleh: r.dibuat_oleh });
  const PROFIL = { nama: 'nama', nip: 'nip_baru', jabatan: 'jabatan', unit: 'unit', kota: 'kota', atasanNama: 'atasan_nama', atasanNip: 'atasan_nip', atasanJabatan: 'atasan_jabatan' };
  const keP = r => { const o = { id: 'profil', peran: r.peran, aktif: r.aktif, username: r.nip }; Object.entries(PROFIL).forEach(([a, b]) => o[a] = r[b] || ''); return o; };
  const fotoPath = id => uid + '/' + id + '.jpg';

  function dataUrlKeBlob(d) { const [h, b] = d.split(','); const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: (h.match(/data:([^;]+)/) || [])[1] || 'image/jpeg' }); }
  const blobKeDataUrl = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
  const ukuran = d => new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({ w: 4, h: 3 }); i.src = d; });

  let bc = null; try { bc = new BroadcastChannel('skp-harian'); } catch (e) { }
  const listeners = new Set();
  if (bc) bc.onmessage = () => listeners.forEach(f => f());
  const notify = () => { try { bc && bc.postMessage('changed'); } catch (e) { } };

  const db = {
    async list(s) {
      const c = client();
      if (s === 'kegiatan') return cek(await c.from('kegiatan').select('*').eq('user_id', uid).order('tanggal').limit(10000)).map(keK);
      if (s === 'rhk') return cek(await c.from('rk').select('*').eq('user_id', uid).order('urutan')).map(keR);
      if (s === 'jenis') return cek(await c.from('jenis_kegiatan').select('*').order('bidang').order('urutan').order('nama')).map(keJ);
      if (s === 'foto') { const ks = await db.list('kegiatan'); const out = []; for (const k of ks) for (const id of k.fotoIds) { const f = await db.get('foto', id); if (f) out.push(f); } return out; }
      return [];
    },
    async get(s, id) {
      const c = client();
      if (s === 'foto') {
        const r = await c.storage.from(BUCKET).download(fotoPath(id)); if (r.error || !r.data) return null;
        const data = await blobKeDataUrl(r.data); return Object.assign({ id, data }, await ukuran(data));
      }
      if (s === 'meta' && id === 'profil') { const r = cek(await c.from('pegawai').select('*').eq('id', uid).maybeSingle()); return r ? keP(r) : { id: 'profil' }; }
      if (s === 'meta') { const r = cek(await c.from('pengaturan').select('value').eq('key', id).maybeSingle()); return r ? Object.assign({ id }, r.value) : null; }
      if (s === 'kegiatan') { const r = cek(await c.from('kegiatan').select('*').eq('id', id).maybeSingle()); return r ? keK(r) : null; }
      if (s === 'rhk') { const r = cek(await c.from('rk').select('*').eq('id', id).maybeSingle()); return r ? keR(r) : null; }
      return null;
    },
    async put(s, o) {
      const c = client();
      if (s === 'foto') { cek(await c.storage.from(BUCKET).upload(fotoPath(o.id), dataUrlKeBlob(o.data), { upsert: true, contentType: 'image/jpeg' }), 'Gagal mengunggah foto'); return o; }
      if (s === 'kegiatan') cek(await c.from('kegiatan').upsert(dariK(o)), 'Gagal menyimpan kegiatan');
      else if (s === 'rhk') cek(await c.from('rk').upsert(dariR(o)), 'Gagal menyimpan RK');
      else if (s === 'jenis') { const r = { id: o.id, bidang: o.bidang, nama: (o.nama || '').trim(), urutan: o.urutan || 0 }; if (!o.dibuatOleh) r.dibuat_oleh = uid; const res = await c.from('jenis_kegiatan').upsert(r); if (res.error && /duplicate|unik/i.test(res.error.message)) throw new Error('Jenis kegiatan "' + r.nama + '" sudah ada di bidang ' + r.bidang); cek(res, 'Gagal menyimpan jenis kegiatan'); }
      else if (s === 'meta' && o.id === 'profil') { const u = {}; Object.entries(PROFIL).forEach(([a, b]) => { if (a !== 'nip') u[b] = (o[a] || '').trim() || null; }); u.nama = u.nama || saya.nama; cek(await c.from('pegawai').update(u).eq('id', uid), 'Gagal menyimpan profil'); Object.assign(saya, u); }
      else if (s === 'meta') { const v = Object.assign({}, o); delete v.id; cek(await c.from('pengaturan').upsert({ key: o.id, value: v }), 'Gagal menyimpan pengaturan'); }
      notify(); return o;
    },
    async del(s, id) {
      const c = client();
      if (s === 'foto') { await c.storage.from(BUCKET).remove([fotoPath(id)]); return; }
      if (s === 'kegiatan') cek(await c.from('kegiatan').delete().eq('id', id));
      else if (s === 'rhk') cek(await c.from('rk').delete().eq('id', id));
      else if (s === 'jenis') cek(await c.from('jenis_kegiatan').delete().eq('id', id), 'Gagal menghapus jenis kegiatan');
      else if (s === 'meta' && id !== 'profil') cek(await c.from('pengaturan').delete().eq('key', id));
      notify();
    }
  };

  /* ---------- Layar login ---------- */
  const CSS = `#skp-login[hidden]{display:none!important}#skp-login{position:fixed;inset:0;z-index:1000;background:linear-gradient(160deg,#1F4E79,#0f2c47);display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;overflow:auto}
  #skp-login .kartu-login{background:#fff;color:#1d2733;border-radius:18px;width:100%;max-width:380px;padding:28px 26px;box-shadow:0 20px 50px rgba(0,0,0,.3)}
  #skp-login img{width:56px;height:56px;border-radius:14px;display:block;margin:0 auto 10px}
  #skp-login h1{font-size:21px;text-align:center;margin:0}#skp-login .sub{text-align:center;color:#5b6878;font-size:13.5px;margin:4px 0 20px}
  #skp-login label{display:block;font-size:12.5px;color:#5b6878;margin:12px 0 5px;font-weight:500}
  #skp-login input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #cfd7e0;border-radius:10px;font-size:16px;font-family:inherit}
  #skp-login input:focus{outline:2px solid #dbe8f5;border-color:#2E75B6}
  #skp-login button{width:100%;margin-top:18px;padding:13px;border:0;border-radius:10px;background:#1F4E79;color:#fff;font-size:15.5px;font-weight:700;cursor:pointer;font-family:inherit}
  #skp-login button:disabled{opacity:.6}#skp-login .err{color:#b42318;font-size:13.5px;margin-top:12px;min-height:1em}
  #skp-login .link{background:none;color:#2E75B6;font-weight:500;font-size:13.5px;padding:6px;margin-top:10px}
  #skp-login .ket{font-size:12.5px;color:#5b6878;background:#f3f8fd;border-radius:8px;padding:9px 11px;margin-top:6px;line-height:1.45}
  #skp-login .pw{position:relative}#skp-login .pw span{position:absolute;right:10px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:12.5px;color:#2E75B6;user-select:none}`;
  function layar(html) {
    let el = document.getElementById('skp-login');
    if (!el) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); el = document.createElement('div'); el.id = 'skp-login'; document.body.appendChild(el); }
    el.innerHTML = `<div class="kartu-login" role="dialog" aria-label="Masuk"><img src="icons/dashboard-192.png" alt=""><h1>SKP Harian</h1><div class="sub">${esc(CFG.NAMA_INSTANSI || 'Jurnal Kinerja Pegawai')}</div>${html}</div>`;
    el.hidden = false; return el;
  }
  const pwField = (id, ac) => `<div class="pw"><input id="${id}" type="password" autocomplete="${ac}" required><span data-lihat="${id}">Lihat</span></div>`;
  function pasangLihat(el) { el.querySelectorAll('[data-lihat]').forEach(s => s.onclick = () => { const i = el.querySelector('#' + s.dataset.lihat); i.type = i.type === 'password' ? 'text' : 'password'; s.textContent = i.type === 'password' ? 'Lihat' : 'Sembunyi'; }); }

  function formLogin(pesan) {
    return new Promise(resolve => {
      const el = layar(`<form id="fLogin"><label for="lNip">NIP lama / username</label><input id="lNip" autocomplete="username" autocapitalize="off" required placeholder="mis. 340012345">
        <label for="lPw">Password</label>${pwField('lPw', 'current-password')}
        <button type="submit">Masuk</button><div class="err" id="lErr">${esc(pesan || '')}</div></form><div id="lSetup"></div>`);
      pasangLihat(el);
      try { const n = localStorage.getItem('skp-nip-terakhir'); if (n) el.querySelector('#lNip').value = n; } catch (e) { }
      el.querySelector(el.querySelector('#lNip').value ? '#lPw' : '#lNip').focus();
      el.querySelector('#fLogin').onsubmit = async e => {
        e.preventDefault(); const b = el.querySelector('button'); b.disabled = true; el.querySelector('#lErr').textContent = '';
        const nip = el.querySelector('#lNip').value.trim();
        const r = await client().auth.signInWithPassword({ email: emailDariNip(nip), password: el.querySelector('#lPw').value });
        b.disabled = false;
        if (r.error) { el.querySelector('#lErr').textContent = /invalid/i.test(r.error.message) ? 'NIP lama/username atau password salah.' : r.error.message; return; }
        try { localStorage.setItem('skp-nip-terakhir', nip); } catch (er) { }
        resolve();
      };
      client().rpc('ada_admin').then(r => {
        if (r.error || r.data !== false) return;
        const s = el.querySelector('#lSetup');
        s.innerHTML = `<button class="link" type="button" id="lMulai">Penyiapan awal: daftarkan admin pertama →</button>`;
        s.querySelector('#lMulai').onclick = () => formAdminPertama().then(resolve);
      });
    });
  }
  function formAdminPertama() {
    return new Promise(resolve => {
      const el = layar(`<form id="fAdm"><div class="ket">Database masih kosong. Akun pertama ini menjadi <b>admin</b> yang nanti menambahkan pegawai lain.</div>
        <label for="aNama">Nama</label><input id="aNama" required placeholder="mis. Admin SKP"><label for="aNip">Username untuk masuk</label><input id="aNip" required autocapitalize="off" placeholder="mis. admin">
        <label for="aPw">Password (min. 6 karakter)</label>${pwField('aPw', 'new-password')}
        <button type="submit">Buat akun admin</button><div class="err" id="aErr"></div></form>`);
      pasangLihat(el);
      el.querySelector('#fAdm').onsubmit = async e => {
        e.preventDefault(); const b = el.querySelector('button'); b.disabled = true; const er = el.querySelector('#aErr'); er.textContent = '';
        try {
          const nip = el.querySelector('#aNip').value.trim().toLowerCase(), pw = el.querySelector('#aPw').value;
          if (!/^[a-z0-9._-]{3,40}$/.test(nip)) throw new Error('Username 3–40 karakter: huruf kecil, angka, titik, minus, atau garis bawah');
          if (pw.length < 6) throw new Error('Password minimal 6 karakter');
          let r = await client().auth.signUp({ email: emailDariNip(nip), password: pw });
          if (r.error && /already/i.test(r.error.message)) r = await client().auth.signInWithPassword({ email: emailDariNip(nip), password: pw });
          if (r.error) throw r.error;
          if (!r.data.session) throw new Error('Akun dibuat tetapi belum aktif. Di Supabase matikan "Confirm email" (lihat PANDUAN), lalu coba lagi.');
          cek(await client().rpc('daftar_admin_pertama', { p_nip: nip, p_nama: el.querySelector('#aNama').value.trim() }));
          try { localStorage.setItem('skp-nip-terakhir', nip); } catch (x) { }
          resolve();
        } catch (x) { er.textContent = x.message || String(x); b.disabled = false; }
      };
    });
  }

  async function mulai(opt = {}) {
    if (!siap()) {
      layar(`<div class="ket" style="background:#fff7e6">${window.supabase ? '<b>Koneksi database belum diatur.</b><br>Buka berkas <code>config.js</code> lalu isi <code>SUPABASE_URL</code> dan <code>SUPABASE_ANON_KEY</code> sesuai PANDUAN.' : '<b>Tidak dapat memuat pustaka database.</b><br>Periksa koneksi internet lalu muat ulang halaman.'}</div>`);
      return new Promise(() => { });
    }
    const c = client(); let pesan = '';
    for (; ;) {
      const { data } = await c.auth.getSession();
      if (!data.session) { await formLogin(pesan); continue; }
      uid = data.session.user.id;
      const r = await c.from('pegawai').select('*').eq('id', uid).maybeSingle();
      if (r.error) { pesan = 'Gagal memuat akun: ' + r.error.message; await c.auth.signOut(); continue; }
      if (!r.data || !r.data.aktif) { pesan = !r.data ? 'Akun ini belum terdaftar sebagai pegawai. Hubungi admin.' : 'Akun Anda dinonaktifkan. Hubungi admin.'; await c.auth.signOut(); continue; }
      saya = r.data; break;
    }
    if (opt.admin && saya.peran !== 'admin') {
      layar(`<div class="ket">Halaman ini khusus <b>admin</b>. Anda masuk sebagai ${esc(saya.nama)}.</div><button type="button" onclick="location.href='index.html'">Ke Dashboard saya</button>`);
      return new Promise(() => { });
    }
    const el = document.getElementById('skp-login'); if (el) el.hidden = true;
    c.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') location.reload(); });
    return { uid, pegawai: saya };
  }
  async function keluar() { try { await client().auth.signOut(); } catch (e) { } location.reload(); }
  async function gantiPassword(pw) { if (!pw || pw.length < 6) throw new Error('Password minimal 6 karakter'); cek(await client().auth.updateUser({ password: pw })); }

  /* ---------- Utilitas ---------- */
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const mkid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function tglPanjang(s) { const d = parseYmd(s); return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear(); }
  function tglSedang(s) { const d = parseYmd(s); return d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear(); }
  function namaBulan(ym) { const [y, m] = ym.split('-').map(Number); return BULAN[m - 1] + ' ' + y; }
  function labelHari(s) { const t = ymd(new Date()); const k = new Date(); k.setDate(k.getDate() - 1); if (s === t) return 'Hari ini'; if (s === ymd(k)) return 'Kemarin'; return tglPanjang(s); }
  function targetBulan(rhk, ym) { if (rhk.targetBulan && rhk.targetBulan[ym] != null && rhk.targetBulan[ym] !== '') return Number(rhk.targetBulan[ym]); return Number(rhk.target || 0); }
  function compressImage(file, max = 1280, q = 0.72) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img; const s = Math.min(1, max / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
        const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url); let data = c.toDataURL('image/jpeg', q); if (data.length > 400000) data = c.toDataURL('image/jpeg', 0.55); res({ data, w, h });
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Gambar tidak bisa dibaca')); };
      img.src = url;
    });
  }
  async function download(filename, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); return true;
  }
  function toast(msg, ms = 2800) {
    let t = document.getElementById('skp-toast'); if (!t) { t = document.createElement('div'); t.id = 'skp-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.className = 'show'; clearTimeout(t._h); t._h = setTimeout(() => t.className = '', ms);
  }

  const api = {
    BULAN, HARI, BIDANG, ymd, parseYmd, uid: mkid, esc, pad, tglPanjang, tglSedang, namaBulan, labelHari, targetBulan, compressImage, download, toast,
    mulai, keluar, gantiPassword, client, emailDariNip, cek, config: CFG,
    get saya() { return saya; },
    backend: async () => ({ mode: 'server' }),
    list: s => db.list(s), get: (s, id) => db.get(s, id), put: (s, o) => db.put(s, o), del: (s, id) => db.del(s, id),
    onChange: f => listeners.add(f),
    async profil() { return db.get('meta', 'profil'); },
    async hapusKegiatan(k) { for (const f of (k.fotoIds || [])) await db.del('foto', f); await db.del('kegiatan', k.id); },
    registerSW() { try { if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { }); } catch (e) { } }
  };
  window.SKP = api;
})();
