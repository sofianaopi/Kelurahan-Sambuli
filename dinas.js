/* SAKTI — Fitur tambahan: Laporan Perjalanan Dinas (pengawasan / pendataan lapangan)
   Pengguna memilih sendiri kegiatan mana yang merupakan perjalanan dinas, melengkapi
   permasalahan & solusi, lalu mengunduh laporan Word beserta lampiran foto kegiatan. */
(function () {
  'use strict';
  const S = window.SKP;
  const $ = id => document.getElementById(id);
  const JENIS = ['Pengawasan Lapangan', 'Pendataan Lapangan'];
  let C = null;              // konteks dari index.html
  let daftar = [], dimuat = false, gagalMuat = '';
  let ed = null;             // laporan yang sedang diedit
  let pilih = new Map();     // kegiatanId -> baris {kegiatanId, tanggal, uraian, masalah, solusi, fotoIds, bidang}
  let templateBuf = null;

  const CSS = `
  .ld-badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.3px;color:#8a5300;background:#fff3db;border:1px solid #f1d39a;border-radius:20px;padding:2px 9px;vertical-align:middle;margin-left:8px}
  .ld-langkah{display:flex;gap:10px;align-items:center;margin:0 0 12px}.ld-langkah b{width:26px;height:26px;border-radius:50%;background:#1F4E79;color:#fff;display:grid;place-items:center;font-size:13px;flex:0 0 auto}
  .ld-langkah h2{margin:0;font-size:16px}
  .ld-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 16px}.ld-g .penuh{grid-column:1/-1}
  .ld-jenis{display:flex;gap:8px;flex-wrap:wrap}.ld-jenis label{display:flex;align-items:center;gap:8px;border:1.5px solid var(--garis);border-radius:10px;padding:10px 14px;cursor:pointer;margin:0;font-weight:600;color:var(--teks)}
  .ld-jenis input{width:auto;margin:0}.ld-jenis label:has(input:checked){border-color:#1F4E79;background:#eef5fc}
  .ld-alat{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.ld-alat input,.ld-alat select{width:auto;flex:1;min-width:150px}.ld-alat input[type=checkbox]{flex:0 0 auto;min-width:0}.ld-alat label{white-space:nowrap}
  .ld-keg{max-height:380px;overflow:auto;border:1px solid var(--garis);border-radius:12px}
  .ld-keg label{display:grid;grid-template-columns:22px 92px 1fr auto;gap:10px;align-items:start;padding:10px 12px;border-top:1px solid var(--garis);margin:0;cursor:pointer;font-weight:400;color:var(--teks)}
  .ld-keg label:first-child{border-top:0}.ld-keg label:hover{background:#f7fbff}.ld-keg input{width:auto;margin:3px 0 0}
  .ld-keg .tg{font-size:12.5px;color:var(--teks2)}.ld-keg .bd{font-size:11.5px;color:#2E75B6;font-weight:600}.ld-keg .ft{font-size:12px;color:var(--teks2);white-space:nowrap}
  .ld-keg label.on{background:#eef5fc}
  .ld-baris{border:1px solid var(--garis);border-radius:12px;padding:12px 14px;margin-top:10px;background:#fff}
  .ld-baris .kp{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:6px}
  .ld-baris .kp b{font-size:14px}.ld-baris textarea{min-height:64px}
  .ld-baris .g3{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:8px}
  .ld-hapus{border:0;background:none;color:#b42318;cursor:pointer;font:inherit;font-size:12.5px}
  .ld-aksi{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:16px}
  .ld-peringatan{color:#8a5300;font-size:12.5px}
  @media (max-width:760px){.ld-g,.ld-baris .g3{grid-template-columns:1fr}.ld-keg label{grid-template-columns:22px 1fr}.ld-keg .tg{grid-column:2}.ld-keg .ft{grid-column:2}}`;

  /* ---------- util ---------- */
  const tglPanjang = d => d ? S.tglSedang(d) : '';
  // [“2026-07-02”,“2026-07-03”,“2026-07-06”] → “2, 3 dan 6 Juli 2026”
  function periodeDari(tgl) {
    // tgl: daftar tanggal 'yyyy-mm-dd' atau 'yyyy-mm-dd..yyyy-mm-dd' (rentang) → semua hari ikut dihitung
    const hari = []; tgl.filter(Boolean).forEach(t => { const [a, b] = String(t).split('..'); if (!b || b <= a) { hari.push(a); return; } const d = S.parseYmd(a); for (let i = 0; i < 62 && S.ymd(d) <= b; i++) { hari.push(S.ymd(d)); d.setDate(d.getDate() + 1); } });
    const L = [...new Set(hari)].sort(); if (!L.length) return '';
    const grup = []; L.forEach(t => { const k = t.slice(0, 7); let g = grup.find(x => x.k === k); if (!g) grup.push(g = { k, h: [] }); g.h.push(Number(t.slice(8))); });
    const gabung = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' dan ' + a[a.length - 1] : String(a[0]);
    const tahunSama = grup.every(g => g.k.slice(0, 4) === grup[0].k.slice(0, 4));
    const teks = grup.map((g, i) => gabung(g.h) + ' ' + S.BULAN[Number(g.k.slice(5)) - 1] + (!tahunSama || i === grup.length - 1 ? ' ' + g.k.slice(0, 4) : ''));
    return gabung(teks);
  }
  const rgTgl = r => r.tanggal + (r.tanggalAkhir && r.tanggalAkhir > r.tanggal ? '..' + r.tanggalAkhir : '');
  const hariBerikut = d => { const t = S.parseYmd(d); t.setDate(t.getDate() + 1); return S.ymd(t); };
  const bersihFile = t => String(t || '').replace(/[\\/:*?"<>|#%\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  const ketuaTersimpan = () => { try { return JSON.parse(localStorage.getItem('sakti-ketua') || '{}'); } catch (e) { return {}; } };
  const simpanKetua = (jab, nama) => { try { const m = ketuaTersimpan(); if (jab && nama) { m[jab] = nama; localStorage.setItem('sakti-ketua', JSON.stringify(m)); } } catch (e) { } };

  async function muat() {
    try { daftar = await S.list('dinas'); dimuat = true; gagalMuat = ''; }
    catch (x) { daftar = []; dimuat = true; gagalMuat = /laporan_dinas|schema cache|does not exist|Could not find/i.test(x.message) ? 'Database belum diperbarui untuk fitur ini. Minta admin menjalankan setup.sql terbaru di Supabase (SQL Editor), lalu muat ulang.' : x.message; }
    return daftar;
  }
  /* id kegiatan yang dipakai di laporan dinas (untuk peringatan sebelum diarsipkan) */
  const kegiatanTerpakai = () => new Set(daftar.flatMap(l => (l.isi || []).map(r => r.kegiatanId).filter(Boolean)));

  /* ---------- tampilan daftar ---------- */
  function kerangka() {
    const v = $('v-dinas'); if (v.dataset.siap) return; v.dataset.siap = '1';
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    v.innerHTML = `
      <div class="kepala"><div style="flex:1"><h1>Laporan Perjalanan Dinas <span class="ld-badge">FITUR TAMBAHAN</span></h1>
        <p>Buat laporan perjalanan dinas <b>pengawasan</b> atau <b>pendataan lapangan</b> dari kegiatan &amp; foto yang sudah Anda catat. Pilih sendiri kegiatan mana yang termasuk perjalanan dinas.</p></div>
        <div><button class="btn utama" type="button" id="ldBaru">+ Buat laporan</button></div></div>
      <div id="ldDaftarBox" class="kartu" style="padding:0"></div>
      <div id="ldEditor" hidden></div>`;
    $('ldBaru').onclick = () => buka(null);
    $('ldDaftarBox').addEventListener('click', klikDaftar);
  }
  function renderDaftar() {
    const box = $('ldDaftarBox'); box.hidden = false; $('ldEditor').hidden = true; $('ldBaru').hidden = false;
    if (gagalMuat) { box.innerHTML = `<div class="kosong" style="color:#b42318">${S.esc(gagalMuat)}</div>`; return; }
    const ada = new Set(C.kegiatan().map(k => k.id));
    box.innerHTML = daftar.length ? `<div class="tabel-wrap"><table class="t"><thead><tr><th>Jenis</th><th>Nomor Surat Tugas</th><th>Periode penugasan</th><th class="num">Kegiatan</th><th class="num">Foto</th><th></th></tr></thead><tbody>${daftar.map(l => {
      const nF = l.isi.reduce((a, r) => a + (r.fotoIds || []).length, 0), hilang = l.isi.filter(r => r.kegiatanId && !ada.has(r.kegiatanId)).length;
      return `<tr data-id="${S.esc(l.id)}"><td><b>${S.esc(l.jenis)}</b></td><td>${S.esc(l.nomor || '—')}${l.tglSt ? '<div style="font-size:12px;color:var(--teks2)">' + S.esc(tglPanjang(l.tglSt)) + '</div>' : ''}</td><td>${S.esc(l.periode || '—')}</td><td class="num">${l.isi.length}</td>
        <td class="num">${nF}${hilang ? `<div class="ld-peringatan" title="Kegiatan sudah diarsipkan ke Drive; fotonya tidak tersedia lagi di aplikasi">⚠ ${hilang} diarsipkan</div>` : ''}</td>
        <td style="text-align:right;white-space:nowrap"><button class="btn kecil utama" type="button" data-ld="unduh">Unduh .docx</button> <button class="btn kecil" type="button" data-ld="ubah">Ubah</button> <button class="btn kecil" type="button" data-ld="hapus" style="color:#b42318">Hapus</button></td></tr>`; }).join('')}</tbody></table></div>`
      : `<div class="kosong">Belum ada laporan perjalanan dinas.<br>Klik <b>“+ Buat laporan”</b>, pilih kegiatan perjalanan dinas Anda, lalu lengkapi permasalahan &amp; solusinya.</div>`;
    box.insertAdjacentHTML('beforeend', '<p style="font-size:12.5px;color:var(--teks2);margin:0;padding:12px 16px;border-top:1px solid var(--garis)">💡 Unduh laporan perjalanan dinas <b>sebelum</b> kegiatannya disimpan &amp; diarsipkan ke Google Drive di menu Upload Dokumen — setelah diarsipkan, foto kegiatan tidak ada lagi di aplikasi.</p>');
  }
  async function klikDaftar(e) {
    const b = e.target.closest('[data-ld]'); if (!b) return; const l = daftar.find(x => x.id === b.closest('tr').dataset.id); if (!l) return;
    if (b.dataset.ld === 'ubah') buka(l);
    else if (b.dataset.ld === 'unduh') unduh(l);
    else if (b.dataset.ld === 'hapus') {
      if (!await C.konfirmasi('Hapus laporan ini?', 'Laporan ' + l.jenis + (l.periode ? ' (' + l.periode + ')' : '') + ' akan dihapus. Kegiatan dan fotonya tidak ikut terhapus.')) return;
      try { await S.del('dinas', l.id); daftar = daftar.filter(x => x !== l); renderDaftar(); S.toast('Laporan dihapus'); } catch (x) { S.toast(x.message, 5000); }
    }
  }

  /* ---------- editor ---------- */
  function buka(l) {
    const keg = C.kegiatan();
    ed = l ? JSON.parse(JSON.stringify(l)) : { id: 'ld_' + S.uid(), jenis: JENIS[0], nomor: '', tglSt: '', periode: '', tempat: 'Kendari', tglLap: '', jabatan: '', ketua: '', isi: [] };
    pilih = new Map(); (ed.isi || []).forEach(r => pilih.set(r.kegiatanId || ('x' + S.uid()), Object.assign({}, r)));
    const bulanAwal = (ed.isi[0] && ed.isi[0].tanggal) ? ed.isi[0].tanggal.slice(0, 7) : (keg.length ? keg[keg.length - 1].tanggal.slice(0, 7) : S.ymd(new Date()).slice(0, 7));
    $('ldDaftarBox').hidden = true; $('ldBaru').hidden = true; const box = $('ldEditor'); box.hidden = false;
    box.innerHTML = `
      <div class="kartu form" style="margin-bottom:14px">
        <div class="ld-langkah"><b>1</b><h2>Jenis &amp; surat tugas</h2></div>
        <div class="ld-jenis">${JENIS.map(j => `<label><input type="radio" name="ldJenis" value="${j}"${ed.jenis === j ? ' checked' : ''}>${j}</label>`).join('')}
          <label><input type="radio" name="ldJenis" value="_lain"${JENIS.includes(ed.jenis) ? '' : ' checked'}>Lainnya: <input id="ldJenisLain" style="width:180px;padding:6px 8px" value="${JENIS.includes(ed.jenis) ? '' : S.esc(ed.jenis)}" placeholder="mis. Koordinasi"></label></div>
        <div class="ld-g" style="margin-top:6px">
          <div><label for="ldNomor">Nomor Surat Tugas</label><input id="ldNomor" value="${S.esc(ed.nomor)}" placeholder="B-1020/74710/KP.650/2026"></div>
          <div><label for="ldTglSt">Tanggal Surat Tugas</label><input type="date" id="ldTglSt" value="${S.esc(ed.tglSt)}"></div>
        </div>
      </div>
      <div class="kartu form" style="margin-bottom:14px">
        <div class="ld-langkah"><b>2</b><h2>Pilih kegiatan perjalanan dinas</h2></div>
        <p style="margin:-4px 0 10px;font-size:13px;color:var(--teks2)">Centang kegiatan yang termasuk perjalanan dinas ini. Foto dari kegiatan terpilih menjadi lampiran dokumentasi.</p>
        <div class="ld-alat"><input type="month" id="ldBulan" value="${bulanAwal}" aria-label="Bulan"><select id="ldBidang" aria-label="Bidang"><option value="">Semua bidang</option>${S.bidangDari(keg.map(k => k.bidang)).map(b => `<option>${S.esc(b)}</option>`).join('')}</select><input type="search" id="ldCari" placeholder="Cari kegiatan…"><label style="display:flex;align-items:center;gap:6px;margin:0;font-weight:500"><input type="checkbox" id="ldFoto" style="width:auto"> hanya yang berfoto</label></div>
        <div class="ld-keg" id="ldKeg"></div>
      </div>
      <div class="kartu form" style="margin-bottom:14px">
        <div class="ld-langkah"><b>3</b><h2>Isi tabel laporan</h2></div>
        <p style="margin:-4px 0 4px;font-size:13px;color:var(--teks2)">Satu baris per kegiatan. Untuk membuat butir (mis. daftar perusahaan), awali baris dengan tanda <b>-</b> .</p>
        <div id="ldBaris"></div>
        <div class="ld-g" style="margin-top:12px"><div class="penuh"><label for="ldPeriode">Periode penugasan <button type="button" id="ldPeriodeAuto" class="ld-hapus" style="color:#2E75B6">↻ isi otomatis dari tanggal kegiatan</button></label><input id="ldPeriode" value="${S.esc(ed.periode)}" placeholder="mis. 2, 3 dan 6 Juli 2026"></div></div>
      </div>
      <div class="kartu form">
        <div class="ld-langkah"><b>4</b><h2>Tanda tangan</h2></div>
        <div class="ld-g">
          <div><label for="ldTempat">Tempat</label><input id="ldTempat" value="${S.esc(ed.tempat || 'Kendari')}"></div>
          <div><label for="ldTglLap">Tanggal laporan</label><input type="date" id="ldTglLap" value="${S.esc(ed.tglLap)}"></div>
          <div><label for="ldJabatan">Mengetahui (jabatan)</label><input id="ldJabatan" value="${S.esc(ed.jabatan)}" placeholder="mis. Ketua Tim Nerwilis"></div>
          <div><label for="ldKetua">Nama yang mengetahui</label><input id="ldKetua" value="${S.esc(ed.ketua)}" list="ldKetuaList" placeholder="mis. Lilis Dinayati"><datalist id="ldKetuaList">${[...new Set(daftar.map(l => l.ketua).concat(Object.values(ketuaTersimpan())).filter(Boolean))].map(n => `<option value="${S.esc(n)}">`).join('')}</datalist></div>
          <div class="penuh" style="font-size:13px;color:var(--teks2);margin-top:6px">Petugas: <b>${S.esc(C.profil().nama || '—')}</b> (dari Profil)</div>
        </div>
        <div class="ld-aksi"><button class="btn" type="button" id="ldBatal">Batal</button><button class="btn" type="button" id="ldSimpan">Simpan</button><button class="btn utama" type="button" id="ldSimpanUnduh">Simpan &amp; unduh .docx</button></div>
      </div>`;
    ['ldBulan', 'ldBidang', 'ldFoto'].forEach(id => $(id).onchange = renderKeg); $('ldCari').oninput = renderKeg;
    $('ldKeg').addEventListener('change', e => { const c = e.target.closest('input[data-k]'); if (!c) return; centang(c.dataset.k, c.checked); });
    $('ldBaris').addEventListener('input', e => { const t = e.target.closest('[data-f]'); if (!t) return; const r = pilih.get(t.closest('[data-k]').dataset.k); if (r) r[t.dataset.f] = t.value; });
    $('ldBaris').addEventListener('click', e => { const b = e.target.closest('[data-lepas]'); if (!b) return; centang(b.dataset.lepas, false); });
    $('ldPeriode').oninput = () => delete $('ldPeriode').dataset.auto; $('ldTglLap').oninput = () => delete $('ldTglLap').dataset.auto;
    $('ldPeriodeAuto').onclick = () => { $('ldPeriode').value = periodeDari([...pilih.values()].map(rgTgl)); };
    $('ldBatal').onclick = () => { ed = null; renderDaftar(); window.scrollTo(0, 0); };
    $('ldSimpan').onclick = () => simpan(false);
    $('ldSimpanUnduh').onclick = () => simpan(true);
    renderKeg(); renderBaris(); window.scrollTo(0, 0);
  }
  function renderKeg() {
    const bl = $('ldBulan').value, bd = $('ldBidang').value, q = $('ldCari').value.trim().toLowerCase(), f = $('ldFoto').checked;
    const L = C.kegiatan().filter(k => (!bl || k.tanggal.startsWith(bl)) && (!bd || k.bidang === bd) && (!q || (k.teks || '').toLowerCase().includes(q)) && (!f || (k.fotoIds || []).length)).slice().sort((a, b) => (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam));
    $('ldKeg').innerHTML = L.length ? L.map(k => `<label class="${pilih.has(k.id) ? 'on' : ''}"><input type="checkbox" data-k="${S.esc(k.id)}"${pilih.has(k.id) ? ' checked' : ''}>
        <span class="tg">${S.esc(S.rentangTgl(k.tanggal, k.tanggalAkhir))}${k.jam ? '<br>' + S.esc(k.jam) : ''}</span><span>${S.esc(k.teks || '(foto bukti)')}${k.bidang ? '<div class="bd">' + S.esc(k.bidang) + '</div>' : ''}</span><span class="ft">${(k.fotoIds || []).length ? '📷 ' + k.fotoIds.length : '—'}</span></label>`).join('')
      : `<div class="kosong" style="padding:18px">Tidak ada kegiatan${bl ? ' pada ' + S.esc(S.namaBulan(bl)) : ''}. Ganti bulan atau saringan di atas.</div>`;
  }
  function centang(id, on) {
    if (on && !pilih.has(id)) { const k = C.kegiatan().find(x => x.id === id); if (!k) return;
      pilih.set(id, { kegiatanId: k.id, tanggal: k.tanggal, ...(k.tanggalAkhir && k.tanggalAkhir > k.tanggal ? { tanggalAkhir: k.tanggalAkhir } : {}), jam: k.jam || '', bidang: k.bidang || '', uraian: k.teks && k.teks !== '(foto bukti)' ? k.teks : '', masalah: '', solusi: '', fotoIds: (k.fotoIds || []).slice() }); }
    if (!on) pilih.delete(id);
    // isi otomatis bagian yang masih kosong
    const rows = [...pilih.values()];
    if (rows.length) {
      if (!$('ldPeriode').value.trim() || $('ldPeriode').dataset.auto) { $('ldPeriode').value = periodeDari(rows.map(rgTgl)); $('ldPeriode').dataset.auto = '1'; }
      if (!$('ldTglLap').value || $('ldTglLap').dataset.auto) { $('ldTglLap').value = hariBerikut(rows.map(r => r.tanggalAkhir || r.tanggal).sort().pop()); $('ldTglLap').dataset.auto = '1'; }
      if (!$('ldJabatan').value.trim()) { const hit = {}; rows.forEach(r => { if (r.bidang) hit[r.bidang] = (hit[r.bidang] || 0) + 1; }); const b = Object.keys(hit).sort((a, c) => hit[c] - hit[a])[0]; if (b) $('ldJabatan').value = 'Ketua Tim ' + b; }
      if (!$('ldKetua').value.trim()) { const n = ketuaTersimpan()[$('ldJabatan').value.trim()]; if (n) $('ldKetua').value = n; }
    }
    renderKeg(); renderBaris();
  }
  const baris = t => Math.min(10, Math.max(3, String(t || '').split('\n').length + Math.floor(String(t || '').length / 45)));
  function renderBaris() {
    const rows = [...pilih.entries()].sort((a, b) => ((a[1].tanggal || '') + (a[1].jam || '')).localeCompare((b[1].tanggal || '') + (b[1].jam || '')));
    const ada = new Set(C.kegiatan().map(k => k.id));
    $('ldBaris').innerHTML = rows.length ? rows.map(([id, r], i) => `<div class="ld-baris" data-k="${S.esc(id)}">
        <div class="kp"><b>${i + 1}. ${S.esc(r.tanggal ? S.rentangTgl(r.tanggal, r.tanggalAkhir) : '—')}</b><span style="font-size:12.5px;color:var(--teks2)">${(r.fotoIds || []).length ? '📷 ' + r.fotoIds.length + ' foto' : 'tanpa foto'}${r.kegiatanId && !ada.has(r.kegiatanId) ? ' · <span class="ld-peringatan">⚠ kegiatan sudah diarsipkan, foto tidak tersedia</span>' : ''} · <button type="button" class="ld-hapus" data-lepas="${S.esc(id)}">Lepas</button></span></div>
        <div class="g3"><div><label>Uraian kegiatan</label><textarea data-f="uraian" rows="${baris(r.uraian)}">${S.esc(r.uraian || '')}</textarea></div>
          <div><label>Permasalahan</label><textarea data-f="masalah" rows="${baris(r.masalah)}" placeholder="mis. Tidak ditemukan permasalahan…">${S.esc(r.masalah || '')}</textarea></div>
          <div><label>Solusi</label><textarea data-f="solusi" rows="${baris(r.solusi)}" placeholder="kosong = “-”">${S.esc(r.solusi || '')}</textarea></div></div></div>`).join('')
      : '<div class="kosong" style="padding:16px">Belum ada kegiatan dipilih. Centang kegiatan pada langkah 2.</div>';
  }
  function kumpulkan() {
    const j = (document.querySelector('input[name=ldJenis]:checked') || {}).value;
    ed.jenis = j === '_lain' ? ($('ldJenisLain').value.trim() || 'Pengawasan Lapangan') : j;
    ed.nomor = $('ldNomor').value.trim(); ed.tglSt = $('ldTglSt').value; ed.periode = $('ldPeriode').value.trim();
    ed.tempat = $('ldTempat').value.trim(); ed.tglLap = $('ldTglLap').value; ed.jabatan = $('ldJabatan').value.trim(); ed.ketua = $('ldKetua').value.trim();
    ed.isi = [...pilih.values()].sort((a, b) => ((a.tanggal || '') + (a.jam || '')).localeCompare((b.tanggal || '') + (b.jam || '')));
    return ed;
  }
  async function simpan(lanjutUnduh) {
    const l = kumpulkan();
    if (!l.isi.length) { S.toast('Pilih minimal satu kegiatan perjalanan dinas (langkah 2)'); return; }
    if (!l.periode) l.periode = periodeDari(l.isi.map(rgTgl));
    try {
      await S.put('dinas', l); simpanKetua(l.jabatan, l.ketua);
      const i = daftar.findIndex(x => x.id === l.id); if (i >= 0) daftar[i] = l; else daftar.unshift(l);
      S.toast('Laporan disimpan');
      if (lanjutUnduh) await unduh(l);
      ed = null; renderDaftar(); window.scrollTo(0, 0);
    } catch (x) { S.toast(/laporan_dinas|schema cache|does not exist/i.test(x.message) ? 'Database belum diperbarui untuk fitur ini — minta admin menjalankan setup.sql terbaru.' : x.message, 6000); }
  }

  /* ---------- dokumen Word ---------- */
  async function ambilTemplate() {
    if (!templateBuf) { const r = await fetch('template-laporan-dinas.docx', { cache: 'no-cache' }); if (!r.ok) throw new Error('Berkas template-laporan-dinas.docx tidak ditemukan di website'); templateBuf = await r.arrayBuffer(); }
    return templateBuf.slice(0);
  }
  async function unduh(l) {
    const sb = S.sibuk('Menyusun laporan perjalanan dinas…');
    try {
      const fotos = []; let hilang = 0, n = 0; const total = l.isi.reduce((a, r) => a + (r.fotoIds || []).length, 0);
      for (const r of l.isi) for (const id of (r.fotoIds || [])) {
        sb.pesan('Mengambil foto ' + (++n) + ' dari ' + total + '…');
        const f = await C.ambilFoto(id).catch(() => null);
        if (f && f.data) fotos.push({ data: f.data, w: f.w, h: f.h, ket: S.rentangTgl(r.tanggal, r.tanggalAkhir) }); else hilang++;
      }
      sb.pesan('Menyusun dokumen Word…');
      const p = C.profil();
      const [kopD, footerD] = await Promise.all([S.get('meta', 'kop_dinas').catch(() => null), S.get('meta', 'footer_dinas').catch(() => null)]);
      const blob = await DOCX.laporanDinas({ template: await ambilTemplate(), kop: kopD, footer: footerD, jenis: l.jenis, nomor: l.nomor, tglSt: l.tglSt ? S.tglSedang(l.tglSt) : '', nama: p.nama || '',
        periode: l.periode || periodeDari(l.isi.map(rgTgl)),
        baris: l.isi.map(r => ({ tanggal: r.tanggal ? S.rentangTgl(r.tanggal, r.tanggalAkhir) : '', uraian: r.uraian, masalah: r.masalah, solusi: r.solusi })),
        tempatTgl: [l.tempat, l.tglLap ? S.tglSedang(l.tglLap) : ''].filter(Boolean).join(', '), jabatan: l.jabatan, ketua: l.ketua, petugas: p.nama || '', fotos });
      sb.selesai();
      const nama = bersihFile('Laporan Perjalanan Dinas ' + l.jenis + '_' + (l.periode || '')).slice(0, 120) + '.docx';
      await S.download(nama, blob);
      S.toast('Laporan siap: ' + nama + (hilang ? ' · ' + hilang + ' foto tidak tersedia (kegiatan sudah diarsipkan)' : ''), hilang ? 7000 : 4000);
    } catch (x) { console.error(x); S.toast('Gagal membuat laporan: ' + (x.message || x), 6000); }
    finally { sb.selesai(); }
  }

  window.SKPDinas = {
    init(ctx) { C = ctx; return muat(); },
    async render() { kerangka(); if (!dimuat) { $('ldDaftarBox').innerHTML = '<div class="kosong">Memuat…</div>'; await muat(); } if (!ed) renderDaftar(); },
    kegiatanTerpakai, periodeDari
  };
})();
