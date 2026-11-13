/* SAKTI — input banyak kegiatan lewat Excel (impor), template, dan ekspor.
   Memakai SheetJS (vendor/xlsx.full.min.js, lisensi Apache-2.0) yang dimuat saat dibutuhkan. */
(function () {
  'use strict';
  const S = window.SKP;
  const BULAN_ID = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
  const BULAN_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  let pustaka = null;
  function lib() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!pustaka) pustaka = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/xlsx.full.min.js'; s.onload = () => res(window.XLSX); s.onerror = () => { pustaka = null; rej(new Error('Pustaka Excel gagal dimuat. Periksa koneksi internet.')); }; document.head.appendChild(s); });
    return pustaka;
  }

  /* ---------- Pembacaan nilai sel ---------- */
  const ymdOk = (y, m, d) => { const t = new Date(y, m - 1, d); return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d ? y + '-' + S.pad(m) + '-' + S.pad(d) : null; };
  function bacaTanggal(v, X) {
    if (v === '' || v == null) return null;
    if (typeof v === 'number' && v > 20000 && v < 80000) { const p = X.SSF.parse_date_code(v); return p ? ymdOk(p.y, p.m, p.d) : null; }
    if (v instanceof Date) return ymdOk(v.getFullYear(), v.getMonth() + 1, v.getDate());
    let t = String(v).trim().toLowerCase().replace(/^(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu),?\s*/, '');
    let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); if (m) return ymdOk(+m[1], +m[2], +m[3]);
    m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (m) { let a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000; if (b > 12 && a <= 12) [a, b] = [b, a]; return ymdOk(y, b, a); }
    m = t.match(/^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})$/);
    if (m) { let i = BULAN_ID.indexOf(m[2]); if (i < 0) i = BULAN_ID.findIndex(b => b.startsWith(m[2].slice(0, 3))); if (i < 0) i = BULAN_EN.indexOf(m[2].slice(0, 3)); if (i >= 0) return ymdOk(+m[3], i + 1, +m[1]); }
    return null;
  }
  function bacaJam(v, X) {
    if (v === '' || v == null) return '';
    if (typeof v === 'number') { const f = v % 1; const mnt = Math.round(f * 1440); if (v >= 0 && (v < 1 || f > 0)) return S.pad(Math.floor(mnt / 60) % 24) + ':' + S.pad(mnt % 60); if (v >= 0 && v < 24) return S.pad(v) + ':00'; return ''; }
    const m = String(v).trim().match(/^(\d{1,2})[:.](\d{2})/) || String(v).trim().match(/^(\d{2})(\d{2})$/);
    if (m && +m[1] < 24 && +m[2] < 60) return S.pad(+m[1]) + ':' + S.pad(+m[2]);
    return null;
  }
  function bacaBidang(v) {
    const t = String(v || '').trim().toLowerCase(); if (!t) return null;
    const langsung = S.BIDANG.find(b => b.toLowerCase() === t); if (langsung) return langsung;
    if (/^(tu|tata usaha|umum|bagian umum|subbag umum)/.test(t)) return 'TU';
    if (/nerwilis|neraca/.test(t)) return 'Nerwilis';
    if (/ipds|pengolahan|diseminasi/.test(t)) return 'IPDS';
    if (/sosial/.test(t)) return 'Sosial'; if (/distribusi/.test(t)) return 'Distribusi'; if (/produksi/.test(t)) return 'Produksi';
    return null;
  }
  const kunci = (tgl, teks) => tgl + '|' + String(teks || '').trim().toLowerCase().replace(/\s+/g, ' ');

  async function baca(file, kegiatanAda) {
    const X = await lib();
    const wb = X.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: false });
    const nama = wb.SheetNames.find(n => /kegiatan/i.test(n)) || wb.SheetNames[0];
    const rows = X.utils.sheet_to_json(wb.Sheets[nama], { header: 1, raw: true, defval: '' });
    let h = rows.findIndex(r => r.some(c => /uraian|kegiatan/i.test(String(c))) && r.some(c => /tanggal|tgl/i.test(String(c))));
    let col = { tgl: 0, jam: 1, bidang: 2, uraian: 3 };
    if (h >= 0) {
      const hd = rows[h].map(c => String(c).toLowerCase());
      const cari = re => hd.findIndex(c => re.test(c));
      col = { tgl: cari(/tanggal|tgl/), jam: cari(/^jam|waktu/), bidang: cari(/bidang/), uraian: cari(/uraian/) };
      if (col.uraian < 0) col.uraian = hd.findIndex(c => /kegiatan/.test(c) && !/bidang/.test(c));
    }
    const ada = new Set((kegiatanAda || []).map(k => kunci(k.tanggal, k.teks)));
    const diFile = new Set(); const hasil = [];
    rows.forEach((r, i) => {
      if (i <= h) return;
      const ambil = c => (c >= 0 ? r[c] : '');
      const teks = String(ambil(col.uraian) || '').trim(); const tglMentah = ambil(col.tgl), bdMentah = ambil(col.bidang), jamMentah = ambil(col.jam);
      if (!teks && (tglMentah === '' || tglMentah == null) && !String(bdMentah).trim()) return;   // baris kosong
      const o = { baris: i + 1, tanggal: bacaTanggal(tglMentah, X), jam: bacaJam(jamMentah, X), bidang: bacaBidang(bdMentah), teks, tglMentah, bdMentah };
      const masalah = [];
      if (!o.tanggal) masalah.push(tglMentah === '' ? 'tanggal kosong' : 'tanggal tidak dikenali (' + tglMentah + ')');
      if (o.jam === null) { masalah.push('jam tidak dikenali (' + jamMentah + ')'); }
      if (!o.bidang) masalah.push(String(bdMentah).trim() ? 'bidang tidak dikenali (' + bdMentah + ')' : 'bidang kosong');
      if (!teks) masalah.push('uraian kosong');
      if (masalah.length) { o.status = 'salah'; o.ket = masalah.join('; '); }
      else { const k = kunci(o.tanggal, teks); if (ada.has(k)) { o.status = 'ada'; o.ket = 'sudah tercatat, dilewati'; } else if (diFile.has(k)) { o.status = 'ada'; o.ket = 'baris ganda di file, dilewati'; } else { o.status = 'ok'; diFile.add(k); } }
      hasil.push(o);
    });
    return hasil;
  }

  function simpanFile(X, wb, nama) {
    const out = X.write(wb, { bookType: 'xlsx', type: 'array' });
    return S.download(nama, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  }
  async function unduhTemplate() {
    const X = await lib(); const wb = X.utils.book_new();
    const ws = X.utils.aoa_to_sheet([['Tanggal', 'Jam', 'Bidang', 'Uraian Kegiatan']]);
    ws['!cols'] = [{ wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 80 }];
    X.utils.book_append_sheet(wb, ws, 'Kegiatan');
    const pt = X.utils.aoa_to_sheet([
      ['PETUNJUK PENGISIAN — isi kegiatan di lembar "Kegiatan", satu baris satu kegiatan'], [''],
      ['Kolom', 'Keterangan'],
      ['Tanggal', 'Wajib. Format 03/11/2026 (tanggal/bulan/tahun) atau tanggal Excel biasa.'],
      ['Jam', 'Opsional. Format 08:30.'],
      ['Bidang', 'Wajib. Salah satu dari: ' + S.BIDANG.join(', ')],
      ['Uraian Kegiatan', 'Wajib. Uraian kegiatan seperti yang akan tampil di daftar [CAPAIAN] dokumen Bukti Dukung.'], [''],
      ['CONTOH (jangan disalin ke lembar Kegiatan):'],
      ['Tanggal', 'Jam', 'Bidang', 'Uraian Kegiatan'],
      ['03/11/2026', '08:30', 'Nerwilis', 'Melakukan kompilasi data triwulanan dari SM dan sumber lain'],
      ['03/11/2026', '13:00', 'Produksi', 'Pendampingan petugas survei ubinan'],
      ['04/11/2026', '', 'TU', 'Menyusun laporan kegiatan bulanan'], [''],
      ['Foto bukti dukung tidak bisa dimasukkan lewat Excel. Setelah impor, tambahkan foto lewat ikon pensil di Dashboard atau dengan mengetuk kegiatan di menu Input.'],
      ['Kegiatan yang tanggal dan uraiannya sama dengan yang sudah tercatat akan dilewati, jadi file yang sama aman diimpor ulang.']
    ]);
    pt['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 80 }];
    X.utils.book_append_sheet(wb, pt, 'Petunjuk');
    await simpanFile(X, wb, 'Template_Input_Kegiatan_SKP_Harian.xlsx');
  }
  async function ekspor(kegiatan, label) {
    const X = await lib(); const wb = X.utils.book_new();
    const ks = kegiatan.slice().sort((a, b) => (a.tanggal + (a.jam || '')).localeCompare(b.tanggal + (b.jam || '')));
    const fmt = t => { const [y, m, d] = t.split('-'); return d + '/' + m + '/' + y; };
    const data = [['Tanggal', 'Jam', 'Bidang', 'Uraian Kegiatan', 'Jumlah Foto', 'Sampai', 'Uraian Gabungan']].concat(ks.map(k => [fmt(k.tanggal), k.jam || '', k.bidang || '', k.teks || '', (k.fotoIds || []).length, k.tanggalAkhir && k.tanggalAkhir > k.tanggal ? fmt(k.tanggalAkhir) : '', k.gabung || '']));
    const ws = X.utils.aoa_to_sheet(data); ws['!cols'] = [{ wch: 12 }, { wch: 7 }, { wch: 11 }, { wch: 80 }, { wch: 11 }, { wch: 12 }, { wch: 50 }];
    X.utils.book_append_sheet(wb, ws, 'Kegiatan');
    await simpanFile(X, wb, 'Kegiatan_SKP_Harian_' + String(label || 'semua').replace(/[^\w]+/g, '_') + '.xlsx');
  }

  /* ---------- Jendela impor ---------- */
  const CSS = `#xl-modal{position:fixed;inset:0;background:rgba(15,25,35,.5);display:none;align-items:center;justify-content:center;z-index:900;padding:14px;font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
  #xl-modal.on{display:flex}#xl-modal .xl-isi{background:#fff;color:#1d2733;border-radius:16px;width:100%;max-width:760px;max-height:94dvh;overflow:auto;padding:20px 22px;font-size:14px;line-height:1.45}
  #xl-modal h3{margin:0 0 4px;font-size:18px}#xl-modal .xl-ket{color:#5b6878;font-size:13px}
  #xl-modal .xl-langkah{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-top:1px solid #e3e8ee;margin-top:12px}
  #xl-modal .xl-no{width:26px;height:26px;border-radius:50%;background:#e7f4ef;color:#005c4b;font-weight:700;display:grid;place-items:center;flex-shrink:0;font-size:13px}
  #xl-modal button{font:inherit;cursor:pointer;border-radius:9px;padding:9px 15px;border:1px solid #d5dce3;background:#fff;font-weight:600;color:#1d2733}
  #xl-modal .xl-link{display:inline-block;text-decoration:none;border-radius:9px;padding:9px 15px;border:1px solid #d5dce3;background:#fff;font-weight:600;color:#1d2733}
  #xl-modal button.utama{background:#008069;border-color:#008069;color:#fff}#xl-modal button:disabled{opacity:.55;cursor:default}
  #xl-modal .xl-ring{background:#f3f8fd;border:1px dashed #b8d0e8;border-radius:10px;padding:10px 12px;margin:10px 0;font-size:13.5px}
  #xl-modal table{width:100%;border-collapse:collapse;font-size:12.5px}#xl-modal th{text-align:left;background:#fafbfc;color:#5b6878;font-weight:600;padding:7px 8px;border-bottom:1px solid #e3e8ee;position:sticky;top:0}
  #xl-modal td{padding:6px 8px;border-bottom:1px solid #eef1f4;vertical-align:top}#xl-modal .xl-tbl{max-height:300px;overflow:auto;border:1px solid #e3e8ee;border-radius:10px}
  #xl-modal .st{font-weight:600;white-space:nowrap}#xl-modal .st.ok{color:#1b6e3a}#xl-modal .st.salah{color:#b42318}#xl-modal .st.ada{color:#8a5300}
  #xl-modal .xl-aksi{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}`;
  let hasil = [], opsi = {};
  function siapkanModal() {
    let m = document.getElementById('xl-modal'); if (m) return m;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    m = document.createElement('div'); m.id = 'xl-modal';
    m.innerHTML = `<div class="xl-isi" role="dialog" aria-labelledby="xlJ">
      <h3 id="xlJ">Input banyak kegiatan dari Excel</h3><div class="xl-ket">Cocok untuk memasukkan banyak kegiatan sekaligus. Foto bukti ditambahkan setelahnya lewat aplikasi.</div>
      <div class="xl-langkah"><div class="xl-no">1</div><div style="flex:1"><b>Unduh template</b><div class="xl-ket">Isi lembar "Kegiatan": Tanggal, Jam (opsional), Bidang, Uraian Kegiatan.</div><div style="margin-top:8px"><a id="xlTpl" class="xl-link" href="template/Template_Input_Kegiatan_SKP_Harian.xlsx" download="Template_Input_Kegiatan_SKP_Harian.xlsx">⬇ Unduh template Excel</a></div></div></div>
      <div class="xl-langkah"><div class="xl-no">2</div><div style="flex:1"><b>Pilih file yang sudah diisi</b><div class="xl-ket">Format .xlsx, .xls, atau .csv.</div><div style="margin-top:8px"><button type="button" id="xlPilih">📂 Pilih file Excel</button> <span id="xlNama" class="xl-ket"></span></div>
        <input type="file" id="xlFile" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" hidden>
        <div id="xlHasil"></div></div></div>
      <div class="xl-aksi"><button type="button" id="xlTutup">Tutup</button><button type="button" class="utama" id="xlSimpan" disabled>Simpan</button></div></div>`;
    document.body.appendChild(m);
    const $ = id => m.querySelector('#' + id);
    $('xlTutup').onclick = () => m.classList.remove('on');
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('on'); });
    $('xlPilih').onclick = () => $('xlFile').click();
    $('xlFile').onchange = async () => {
      const f = $('xlFile').files[0]; $('xlFile').value = ''; if (!f) return;
      $('xlNama').textContent = f.name; $('xlHasil').innerHTML = '<div class="xl-ring">Membaca file…</div>'; $('xlSimpan').disabled = true;
      try { hasil = await baca(f, opsi.kegiatanAda ? opsi.kegiatanAda() : []); tampilkan(m); }
      catch (x) { console.error(x); hasil = []; $('xlHasil').innerHTML = `<div class="xl-ring" style="border-color:#f1b5b5;background:#fdf1f1">File tidak bisa dibaca: ${S.esc(x.message || x)}</div>`; }
    };
    $('xlSimpan').onclick = async () => {
      const siap = hasil.filter(o => o.status === 'ok'); if (!siap.length) return;
      const b = $('xlSimpan'); b.disabled = true;
      const sekarang = Date.now();
      const daftar = siap.map((o, i) => ({ id: 'k' + S.uid() + i.toString(36), tanggal: o.tanggal, jam: o.jam || '', teks: o.teks, bidang: o.bidang, jenisId: null, rhkId: null, jumlah: 1, fotoIds: [], dibuat: sekarang + i }));
      try {
        await S.putBanyak('kegiatan', daftar, (n, t) => { b.textContent = 'Menyimpan ' + n + '/' + t + '…'; });
        m.classList.remove('on'); S.toast(daftar.length + ' kegiatan dari Excel berhasil disimpan', 4000);
        if (opsi.selesai) opsi.selesai(daftar);
      } catch (x) { S.toast(x.message || String(x), 6000); b.disabled = false; b.textContent = 'Coba simpan lagi'; }
    };
    return m;
  }
  function tampilkan(m) {
    const $ = id => m.querySelector('#' + id);
    const n = s => hasil.filter(o => o.status === s).length; const ok = n('ok');
    const LBL = { ok: '✓ Siap', salah: '✕ Perlu diperbaiki', ada: '– Dilewati' };
    $('xlHasil').innerHTML = `<div class="xl-ring"><b>${ok} kegiatan siap disimpan</b>${n('salah') ? ` · <span style="color:#b42318">${n('salah')} baris perlu diperbaiki</span>` : ''}${n('ada') ? ` · ${n('ada')} dilewati (sudah ada)` : ''}${!hasil.length ? '<br>Tidak ada baris kegiatan di file ini. Pastikan diisi di lembar "Kegiatan".' : ''}${n('salah') ? '<br><span class="xl-ket">Baris yang salah tidak ikut disimpan. Perbaiki di Excel lalu pilih file lagi, atau simpan yang sudah benar dulu.</span>' : ''}</div>` +
      (hasil.length ? `<div class="xl-tbl"><table><thead><tr><th>Baris</th><th>Tanggal</th><th>Jam</th><th>Bidang</th><th>Uraian kegiatan</th><th>Status</th></tr></thead><tbody>${hasil.slice(0, 500).map(o => `<tr><td>${o.baris}</td><td style="white-space:nowrap">${o.tanggal ? S.esc(S.tglSedang(o.tanggal)) : S.esc(o.tglMentah)}</td><td>${S.esc(o.jam || '')}</td><td>${S.esc(o.bidang || o.bdMentah || '')}</td><td>${S.esc(o.teks)}</td><td class="st ${o.status}">${LBL[o.status]}${o.ket ? '<div style="font-weight:400;font-size:12px">' + S.esc(o.ket) + '</div>' : ''}</td></tr>`).join('')}</tbody></table></div>${hasil.length > 500 ? '<div class="xl-ket">Menampilkan 500 baris pertama.</div>' : ''}` : '');
    $('xlSimpan').disabled = !ok; $('xlSimpan').textContent = ok ? 'Simpan ' + ok + ' kegiatan' : 'Simpan';
  }
  function bukaImpor(o) { lib().catch(() => { }); opsi = o || {}; hasil = []; const m = siapkanModal(); m.querySelector('#xlHasil').innerHTML = ''; m.querySelector('#xlNama').textContent = ''; const b = m.querySelector('#xlSimpan'); b.disabled = true; b.textContent = 'Simpan'; m.classList.add('on'); }

  window.SKPExcel = { lib, bukaImpor, unduhTemplate, ekspor, baca, _bacaTanggal: bacaTanggal, _bacaJam: bacaJam, _bacaBidang: bacaBidang };
})();
