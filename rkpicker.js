/* SAKTI — panel pemilih RK (bukan dropdown): RK bidang terpilih tampil utuh beserta IKI, bisa dicari. */
(function () {
  'use strict';
  const S = window.SKP;
  const CSS = `#rkp{position:fixed;inset:0;background:rgba(11,20,26,.5);display:none;z-index:950;align-items:flex-end;justify-content:center;font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
  #rkp.on{display:flex}@media(min-width:760px){#rkp{align-items:center;padding:20px}}
  #rkp .rkp-isi{background:#fff;color:#1d2733;width:100%;max-width:720px;max-height:88dvh;display:flex;flex-direction:column;border-radius:16px 16px 0 0;overflow:hidden}
  @media(min-width:760px){#rkp .rkp-isi{border-radius:16px}}
  #rkp .rkp-kepala{padding:16px 16px 10px;border-bottom:1px solid #e3e8ee}
  #rkp h3{margin:0 0 2px;font-size:17px}#rkp .rkp-sub{font-size:12.5px;color:#5b6878}
  #rkp .rkp-bd{display:flex;gap:6px;overflow-x:auto;margin:10px 0 8px;scrollbar-width:none}#rkp .rkp-bd::-webkit-scrollbar{display:none}
  #rkp .rkp-bd button{flex-shrink:0;border:1px solid #d1d7db;background:#fff;border-radius:16px;padding:5px 11px;font:inherit;font-size:12.5px;cursor:pointer;color:#3b4a54}
  #rkp .rkp-bd button.on{background:#1F4E79;border-color:#1F4E79;color:#fff}
  #rkp input{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:10px 12px;border:1px solid #cfd7e0;border-radius:10px}
  #rkp .rkp-daftar{overflow-y:auto;padding:8px 12px 12px;flex:1}
  #rkp .rkp-item{display:flex;gap:10px;width:100%;text-align:left;background:#fff;border:1px solid #e3e8ee;border-radius:12px;padding:10px 12px;margin:6px 0;cursor:pointer;font:inherit;color:inherit}
  #rkp .rkp-item:hover{border-color:#9cbfe0;background:#f7fbff}#rkp .rkp-item.on{border:2px solid #1F4E79;background:#eef5fc;padding:9px 11px}
  #rkp .rkp-no{flex-shrink:0;width:26px;height:26px;border-radius:50%;background:#dbe8f5;color:#1F4E79;font-weight:700;font-size:12.5px;display:grid;place-items:center}
  #rkp .rkp-rk{font-size:14px;line-height:1.4;font-weight:600}#rkp .rkp-iki{font-size:12.5px;color:#5b6878;margin-top:3px;line-height:1.35}
  #rkp .rkp-tag{display:inline-block;font-size:11px;font-weight:600;background:#eef1f4;color:#4b5866;border-radius:6px;padding:1px 6px;margin-left:6px;vertical-align:middle}
  #rkp .rkp-kosong{text-align:center;color:#5b6878;font-size:13.5px;padding:24px 10px}
  #rkp .rkp-kaki{display:flex;gap:8px;justify-content:space-between;align-items:center;padding:10px 14px calc(10px + env(safe-area-inset-bottom));border-top:1px solid #e3e8ee}
  #rkp .rkp-kaki button{font:inherit;cursor:pointer;border-radius:9px;padding:9px 14px;border:1px solid #d5dce3;background:#fff;font-weight:600;color:#1d2733}
  #rkp mark{background:#fff1a8;color:inherit;padding:0}`;
  let opsi = {}, bidang = '', q = '';
  function siapkan() {
    let m = document.getElementById('rkp'); if (m) return m;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    m = document.createElement('div'); m.id = 'rkp';
    m.innerHTML = `<div class="rkp-isi" role="dialog" aria-labelledby="rkpJ"><div class="rkp-kepala"><h3 id="rkpJ">Pilih Rencana Kinerja (RK)</h3><div class="rkp-sub" id="rkpSub"></div>
      <div class="rkp-bd" id="rkpBd"></div><input type="search" id="rkpCari" placeholder="Cari kata dalam RK atau IKI…" aria-label="Cari RK"></div>
      <div class="rkp-daftar" id="rkpDaftar"></div>
      <div class="rkp-kaki"><a id="rkpKelola" href="index.html#rk" style="font-size:13px;color:#2E75B6">Kelola RK &amp; IKI</a><div style="display:flex;gap:8px"><button type="button" id="rkpLepas">Tanpa RK</button><button type="button" id="rkpTutup">Tutup</button></div></div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) tutup(); });
    m.querySelector('#rkpTutup').onclick = tutup;
    m.querySelector('#rkpLepas').onclick = () => pilih(null);
    m.querySelector('#rkpCari').oninput = e => { q = e.target.value.trim().toLowerCase(); daftar(); };
    m.querySelector('#rkpDaftar').addEventListener('click', e => { const b = e.target.closest('[data-rk]'); if (b) pilih(b.dataset.rk); });
    m.querySelector('#rkpBd').addEventListener('click', e => { const b = e.target.closest('[data-bd]'); if (!b) return; bidang = b.dataset.bd; tombolBidang(); daftar(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && m.classList.contains('on')) tutup(); });
    return m;
  }
  const tandai = (t, kata) => { const e = S.esc(t); if (!kata) return e; const i = e.toLowerCase().indexOf(S.esc(kata)); return i < 0 ? e : e.slice(0, i) + '<mark>' + e.slice(i, i + S.esc(kata).length) + '</mark>' + e.slice(i + S.esc(kata).length); };
  function tombolBidang() {
    const daftarRk = opsi.rhkList || [];
    const n = b => daftarRk.filter(r => !b || r.bidang === b).length;
    document.getElementById('rkpBd').innerHTML = S.bidangDari(daftarRk.map(r => r.bidang)).filter(b => n(b)).concat(['']).map(b => `<button type="button" data-bd="${S.esc(b)}" class="${bidang === b ? 'on' : ''}">${b ? S.esc(b) : 'Semua bidang'} (${n(b)})</button>`).join('') +
      (daftarRk.some(r => !r.bidang) ? `<button type="button" data-bd="-" class="${bidang === '-' ? 'on' : ''}">Tanpa bidang (${daftarRk.filter(r => !r.bidang).length})</button>` : '');
  }
  function daftar() {
    const semua = opsi.rhkList || [];
    const rk = semua.map((r, i) => ({ r, no: i + 1 })).filter(x => (!bidang || (bidang === '-' ? !x.r.bidang : x.r.bidang === bidang)) && (!q || ((x.r.nama || '') + ' ' + (x.r.indikator || '')).toLowerCase().includes(q)));
    document.getElementById('rkpSub').textContent = (opsi.bidang ? 'Bidang kegiatan: ' + opsi.bidang + ' · ' : '') + rk.length + ' RK ditampilkan';
    const el = document.getElementById('rkpDaftar');
    if (!semua.length) { el.innerHTML = '<div class="rkp-kosong">Belum ada RK. Tambahkan dulu di menu <a href="index.html#rk">RK &amp; IKI</a>.</div>'; return; }
    el.innerHTML = rk.length ? rk.map(x => `<button type="button" class="rkp-item${x.r.id === opsi.terpilih ? ' on' : ''}" data-rk="${x.r.id}"><span class="rkp-no">${x.no}</span><span><div class="rkp-rk">${tandai(x.r.nama || '(tanpa judul)', q)}${!bidang && x.r.bidang ? `<span class="rkp-tag">${S.esc(x.r.bidang)}</span>` : ''}${x.r.bersama ? '<span class="rkp-tag" style="background:#e8f0fa;color:#1F4E79">🔒 admin</span>' : ''}</div>${x.r.indikator ? `<div class="rkp-iki">IKI: ${tandai(x.r.indikator, q)}</div>` : ''}</span></button>`).join('')
      : `<div class="rkp-kosong">${q ? 'Tidak ada RK yang cocok dengan “' + S.esc(q) + '”.' : 'Belum ada RK untuk bidang ini.'}<br><button type="button" data-bd="" class="rkp-semua" style="margin-top:8px;font:inherit;border:1px solid #d5dce3;background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer">Tampilkan semua bidang</button></div>`;
    const sb = el.querySelector('.rkp-semua'); if (sb) sb.onclick = () => { bidang = ''; tombolBidang(); daftar(); };
  }
  function pilih(id) { const f = opsi.onPilih; tutup(); if (f) f(id ? (opsi.rhkList || []).find(r => r.id === id) || null : null); }
  function tutup() { const m = document.getElementById('rkp'); if (m) m.classList.remove('on'); }
  /* o: {rhkList, bidang, terpilih, judul, onPilih(rk|null)} */
  function buka(o) {
    opsi = o || {}; q = ''; const m = siapkan();
    const ada = b => (opsi.rhkList || []).some(r => r.bidang === b);
    bidang = opsi.bidang && ada(opsi.bidang) ? opsi.bidang : '';
    m.querySelector('#rkpJ').textContent = opsi.judul || 'Pilih Rencana Kinerja (RK)';
    m.querySelector('#rkpCari').value = ''; tombolBidang(); daftar(); m.classList.add('on');
    const ab = m.querySelector('.rkp-bd .on'); if (ab) ab.scrollIntoView({ inline: 'center', block: 'nearest' });
    const t = m.querySelector('.rkp-item.on'); if (t) t.scrollIntoView({ block: 'center' });
    if (matchMedia('(pointer:fine)').matches) setTimeout(() => m.querySelector('#rkpCari').focus(), 50);
  }
  window.SKPPilihRK = { buka, tutup };
})();
