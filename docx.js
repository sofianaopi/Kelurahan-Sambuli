/* SAKTI — pembuat dokumen Word (.docx) langsung di browser, tanpa library luar */
(function () {
  'use strict';
  const enc = new TextEncoder();

  /* ---------- ZIP (metode STORE) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const parts = [], central = []; let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name); const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  /* ---------- Penyusun XML WordprocessingML ---------- */
  const x = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  function run(text, o = {}) {
    const rpr = (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.color ? `<w:color w:val="${o.color}"/>` : '') + (o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : '') + (o.u ? '<w:u w:val="single"/>' : '');
    const lines = String(text == null ? '' : text).split('\n');
    return `<w:r>${rpr ? '<w:rPr>' + rpr + '</w:rPr>' : ''}${lines.map((l, i) => (i ? '<w:br/>' : '') + `<w:t xml:space="preserve">${x(l)}</w:t>`).join('')}</w:r>`;
  }
  function p(content, o = {}) {
    const runs = Array.isArray(content) ? content.map(c => typeof c === 'string' ? (c.startsWith('<w:r') ? c : run(c, o)) : run(c.t, Object.assign({}, o, c))).join('') : (String(content).startsWith('<w:r') ? content : run(content, o));
    const ppr = (o.keep ? '<w:keepNext/>' : '') + (o.pageBreak ? '<w:pageBreakBefore/>' : '') + `<w:spacing w:before="${o.before || 0}" w:after="${o.after == null ? 0 : o.after}" w:line="${o.line || 240}" w:lineRule="auto"/>` + (o.jc ? `<w:jc w:val="${o.jc}"/>` : '');
    return `<w:p><w:pPr>${ppr}</w:pPr>${runs}</w:p>`;
  }
  function tc(content, w, o = {}) {
    const inner = Array.isArray(content) ? content.join('') : (String(content).startsWith('<w:p') ? content : p(content, o));
    const pr = `<w:tcW w:w="${w}" w:type="dxa"/>` + (o.span ? `<w:gridSpan w:val="${o.span}"/>` : '') + (o.vMerge === 'restart' ? '<w:vMerge w:val="restart"/>' : o.vMerge ? '<w:vMerge/>' : '') + (o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : '') + `<w:vAlign w:val="${o.va || 'top'}"/>`;
    return `<w:tc><w:tcPr>${pr}</w:tcPr>${inner || '<w:p/>'}</w:tc>`;
  }
  function tr(cells, o = {}) { return `<w:tr><w:trPr>${o.header ? '<w:tblHeader/>' : ''}${o.cantSplit ? '<w:cantSplit/>' : ''}</w:trPr>${cells.join('')}</w:tr>`; }
  function tbl(widths, rows, o = {}) {
    const b = o.borders === false ? 'none' : 'single';
    const bd = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="${b}" w:sz="4" w:space="0" w:color="${o.borderColor || '000000'}"/>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a, c) => a + c, 0)}" w:type="dxa"/><w:tblBorders>${bd}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="${o.padV == null ? 50 : o.padV}" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="${o.padV == null ? 50 : o.padV}" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`;
  }
  let picId = 1;
  function img(rId, wEmu, hEmu) {
    const n = picId++;
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${wEmu}" cy="${hEmu}"/><wp:docPr id="${n}" name="Foto ${n}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="foto${n}.jpeg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${wEmu}" cy="${hEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }
  function dataUrlBytes(d) { const b = atob(d.split(',')[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

  /* ---------- Membaca template Word (untuk mengambil kop surat) ---------- */
  async function readZip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf); const out = {};
    let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Berkas bukan dokumen Word (.docx)');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
    for (let i = 0; i < n; i++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      out[name] = { method, raw: u8.subarray(start, start + csize) };
    }
    return {
      names: Object.keys(out),
      async get(name) {
        const f = out[name]; if (!f) return null; if (f.method === 0) return f.raw.slice();
        if (typeof DecompressionStream === 'undefined') throw new Error('Browser terlalu lama untuk membaca template. Perbarui Chrome/Safari.');
        const ds = new Blob([f.raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(ds).arrayBuffer());
      }
    };
  }
  const td = u => new TextDecoder().decode(u);
  const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  /* Ambil header (kop) atau footer dari dokumen Word, beserta gambar & gaya yang dipakai */
  async function extractBagian(buf, jenis) {
    const k = await extractKop(buf, jenis);
    return { xml: k.headerXml, rels: k.hrels, media: k.media, styles: k.styles };
  }
  async function extractKop(buf, jenis = 'header') {
    const tag = jenis === 'footer' ? 'footerReference' : 'headerReference', awalan = jenis === 'footer' ? 'ftr_' : 'kop_';
    const z = await readZip(buf);
    const doc = td(await z.get('word/document.xml'));
    const rels = td(await z.get('word/_rels/document.xml.rels'));
    const sects = doc.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g) || [];
    let hdrId = null, sect = null;
    for (const sp of sects) { const m = sp.match(new RegExp('<w:' + tag + '[^>]*w:type="default"[^>]*r:id="([^"]+)"')) || sp.match(new RegExp('<w:' + tag + '[^>]*r:id="([^"]+)"[^>]*w:type="default"')); if (m) { hdrId = m[1]; sect = sp; break; } }
    sect = sect || sects[sects.length - 1] || '';
    const pgSz = (sect.match(/<w:pgSz[^>]*\/>/) || ['<w:pgSz w:w="11906" w:h="16838"/>'])[0];
    const pgMar = (sect.match(/<w:pgMar[^>]*\/>/) || ['<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/>'])[0];
    if (!hdrId) throw new Error(jenis === 'footer' ? 'Dokumen ini tidak memiliki footer. Isi footer di Word (Insert → Footer), simpan, lalu unggah lagi.' : 'Dokumen ini tidak memiliki kop/header. Isi kop di Word (Insert → Header), simpan, lalu unggah lagi.');
    const rel = rels.match(new RegExp('<Relationship[^>]*Id="' + hdrId + '"[^>]*>')) [0];
    const target = rel.match(/Target="([^"]+)"/)[1].replace(/^\/?word\//, '');
    const headerXml = td(await z.get('word/' + target));
    const hname = target.split('/').pop();
    let hrels = td(await z.get('word/_rels/' + hname + '.rels') || new Uint8Array());
    const media = [];
    for (const m of hrels.matchAll(/Target="(media\/[^"]+)"/g)) {
      const data = await z.get('word/' + m[1]); if (!data) continue;
      const nm = awalan + m[1].split('/').pop(); media.push({ name: nm, b64: b64(data) });
    }
    hrels = hrels.replace(/Target="media\/([^"]+)"/g, 'Target="media/' + awalan + '$1"');
    // gaya (style) yang dipakai kop, beserta induknya, agar ukuran huruf kop sama persis
    let styles = '';
    try {
      const sx = td(await z.get('word/styles.xml'));
      const want = new Set([...headerXml.matchAll(/w:(?:pStyle|rStyle|tblStyle) w:val="([^"]+)"/g)].map(m => m[1]));
      const done = new Set(['Normal', 'TableNormal']); const q = [...want];
      while (q.length) {
        const id = q.shift(); if (done.has(id)) continue; done.add(id);
        const m = sx.match(new RegExp('<w:style [^>]*w:styleId="' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[\\s\\S]*?</w:style>'));
        if (!m) continue; styles += m[0].replace(/<w:link [^>]*\/>/g, '');
        const b = m[0].match(/<w:basedOn w:val="([^"]+)"/); if (b) q.push(b[1]);
      }
    } catch (e) { }
    return { headerXml, hrels, media, pgSz, pgMar, styles };
  }
  function pageInfo(kop) {
    const sz = kop ? kop.pgSz : '<w:pgSz w:w="11906" w:h="16838"/>';
    const mar = kop ? kop.pgMar : '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/>';
    const g = (s, a) => Number((s.match(new RegExp('w:' + a + '="(\\d+)"')) || [])[1] || 0);
    return { sz, mar, W: g(sz, 'w') - g(mar, 'left') - g(mar, 'right') };
  }
  const MIME = { png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', gif: 'image/gif', emf: 'image/x-emf', wmf: 'image/x-wmf', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', svg: 'image/svg+xml' };

  function build(bodyXml, images, opt = {}) {
    const kop = opt.kop || null; const pg = pageInfo(kop);
    const font = opt.font || 'Arial', fsz = opt.sz || 21;
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${bodyXml}<w:sectPr>${kop ? '<w:headerReference w:type="default" r:id="rIdKop"/>' : ''}${pg.sz}${pg.mar}</w:sectPr></w:body></w:document>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/><w:sz w:val="${fsz}"/><w:szCs w:val="${fsz}"/><w:lang w:val="id-ID"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${kop && kop.styles ? kop.styles : ''}<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${kop ? '<Relationship Id="rIdKop" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="kop_header.xml"/>' : ''}${images.map(i => `<Relationship Id="${i.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${i.name}"/>`).join('')}</Relationships>`;
    const exts = new Set(['jpeg']); if (kop) kop.media.forEach(m => exts.add(m.name.split('.').pop().toLowerCase()));
    const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${[...exts].map(e => `<Default Extension="${e}" ContentType="${MIME[e] || 'application/octet-stream'}"/>`).join('')}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>${kop ? '<Override PartName="/word/kop_header.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ''}</Types>`;
    const root = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
    const files = [
      { name: '[Content_Types].xml', data: ct }, { name: '_rels/.rels', data: root },
      { name: 'word/document.xml', data: doc }, { name: 'word/styles.xml', data: styles },
      { name: 'word/_rels/document.xml.rels', data: rels },
      ...images.map(i => ({ name: 'word/media/' + i.name, data: i.bytes }))
    ];
    if (kop) {
      files.push({ name: 'word/kop_header.xml', data: kop.headerXml });
      if (kop.hrels) files.push({ name: 'word/_rels/kop_header.xml.rels', data: kop.hrels });
      kop.media.forEach(m => files.push({ name: 'word/media/' + m.name, data: unb64(m.b64) }));
    }
    return zip(files);
  }

  /* ---------- Laporan SKP ---------- */
  let W = 9638; // lebar isi halaman (dxa); disesuaikan dengan ukuran kertas template
  const sc = arr => { const t = arr.reduce((a, c) => a + c, 0); const r = arr.map(x => Math.floor(x * W / t)); r[r.length - 1] += W - r.reduce((a, c) => a + c, 0); return r; };
  const HEAD = 'DCE6F1';

  function blokIdentitas(pr, periode) {
    const row = (l, v) => tr([tc(p(l), 2300), tc(p(':'), 300), tc(p(v || '-'), W - 2600)]);
    return tbl([2300, 300, W - 2600], [
      row('Nama', pr.nama), row('NIP', pr.nip), row('Jabatan', pr.jabatan), row('Unit Kerja', pr.unit), row('Periode', periode)
    ], { borders: false, padV: 10 });
  }
  function blokTtd(pr, tglTtd) {
    const S = window.SKP;
    const c = { jc: 'center' };
    const kiri = [p('Mengetahui,', c), p('Pejabat Penilai Kinerja', c), p(pr.atasanJabatan || '', c), p('', c), p('', c), p('', c), p('', c),
      p(pr.atasanNama || '(...................................)', { b: true, u: true, jc: 'center' }), p('NIP. ' + (pr.atasanNip || '..............................'), c)];
    const kanan = [p((pr.kota ? pr.kota + ', ' : '') + S.tglSedang(tglTtd), c), p('Pegawai yang Dinilai', c), p(pr.jabatan || '', c), p('', c), p('', c), p('', c), p('', c),
      p(pr.nama || '(...................................)', { b: true, u: true, jc: 'center' }), p('NIP. ' + (pr.nip || '..............................'), c)];
    return p('', { after: 240 }) + tbl([W / 2, W / 2], [tr([tc(kiri, W / 2), tc(kanan, W / 2)], { cantSplit: true })], { borders: false });
  }

  function judul(t, sub) { return p(t, { b: true, jc: 'center', sz: 26 }) + (sub ? p(sub, { b: true, jc: 'center', sz: 22, after: 200 }) : p('', { after: 200 })); }

  function tabelHarian(kegiatan, rhkMap, lampiranNo) {
    const S = window.SKP;
    const w = sc([480, 1650, 3500, 1250, 1858, 900]);
    const hd = ['No', 'Hari / Tanggal', 'Uraian Kegiatan', 'Output', 'Rencana Kinerja (RK)', 'Bukti'];
    const rows = [tr(hd.map((h, i) => tc(p(h, { b: true, jc: 'center' }), w[i], { fill: HEAD, va: 'center' })), { header: true })];
    let no = 0; let lastTgl = null;
    const kt = k => k.tanggal + '|' + (k.tanggalAkhir && k.tanggalAkhir > k.tanggal ? k.tanggalAkhir : '');
    const counts = {}; kegiatan.forEach(k => counts[kt(k)] = (counts[kt(k)] || 0) + 1);
    for (const k of kegiatan) {
      no++;
      const r = k.rhkId ? rhkMap[k.rhkId] : null;
      const first = kt(k) !== lastTgl; lastTgl = kt(k);
      const merge = counts[kt(k)] > 1 ? (first ? 'restart' : true) : null;
      const tglCell = first ? (k.tanggalAkhir && k.tanggalAkhir > k.tanggal ? [p(S.tglPanjang(k.tanggal)), p('s.d. ' + S.tglPanjang(k.tanggalAkhir))] : p(S.tglPanjang(k.tanggal))) : p('');
      const uraian = (k.jam ? [p(k.teks || '-'), p(k.jam, { sz: 16, color: '808080' })] : [p(k.teks || '-')]);
      const output = r ? (k.jumlah || 1) + ' ' + (r.satuan || '') : (k.jumlah > 1 ? String(k.jumlah) : '-');
      const bukti = (lampiranNo && lampiranNo[k.id]) ? 'Lamp. ' + lampiranNo[k.id] : ((k.fotoIds || []).length ? (k.fotoIds.length + ' foto') : '-');
      rows.push(tr([
        tc(p(no + '.', { jc: 'center' }), w[0]), tc(tglCell, w[1], { vMerge: merge }), tc(uraian, w[2]),
        tc(p(output, { jc: 'center' }), w[3]), tc(p(r ? r.nama : '-'), w[4]), tc(p(bukti, { jc: 'center' }), w[5])
      ]));
    }
    if (!kegiatan.length) rows.push(tr([tc(p('Belum ada kegiatan pada periode ini.', { i: true, jc: 'center' }), W, { span: 6 })]));
    return tbl(w, rows);
  }

  function tabelRealisasi(rhkList, kegiatan, ym) {
    const S = window.SKP;
    const w = sc([480, 3500, 1050, 900, 1150, 1100, 1458]);
    const hd = ['No', 'Rencana Kinerja / Indikator', 'Satuan', 'Target', 'Realisasi', 'Capaian (%)', 'Jumlah Kegiatan'];
    const rows = [tr(hd.map((h, i) => tc(p(h, { b: true, jc: 'center' }), w[i], { fill: HEAD, va: 'center' })), { header: true })];
    let sumCap = 0, nCap = 0;
    rhkList.forEach((r, i) => {
      const ks = kegiatan.filter(k => k.rhkId === r.id);
      const real = ks.reduce((a, k) => a + (Number(k.jumlah) || 1), 0);
      const tgt = S.targetBulan(r, ym);
      const cap = tgt > 0 ? Math.round(real / tgt * 1000) / 10 : null;
      if (cap != null) { sumCap += Math.min(cap, 100); nCap++; }
      const nama = r.indikator ? [p(r.nama), p('Indikator: ' + r.indikator, { i: true, sz: 18, color: '555555' })] : [p(r.nama)];
      rows.push(tr([tc(p((i + 1) + '.', { jc: 'center' }), w[0]), tc(nama, w[1]), tc(p(r.satuan || '-', { jc: 'center' }), w[2]),
        tc(p(String(tgt), { jc: 'center' }), w[3]), tc(p(String(real), { jc: 'center' }), w[4]),
        tc(p(cap == null ? '-' : String(cap).replace('.', ','), { jc: 'center' }), w[5]), tc(p(String(ks.length), { jc: 'center' }), w[6])]));
    });
    if (!rhkList.length) rows.push(tr([tc(p('Belum ada Rencana Kinerja. Isi di menu Target SKP.', { i: true, jc: 'center' }), W, { span: 7 })]));
    else {
      const avg = nCap ? Math.round(sumCap / nCap * 10) / 10 : 0;
      rows.push(tr([tc(p('Rata-rata capaian (maks. 100% per RK)', { b: true, jc: 'right' }), w[0] + w[1] + w[2] + w[3] + w[4], { span: 5, fill: 'F2F2F2' }), tc(p(String(avg).replace('.', ','), { b: true, jc: 'center' }), w[5], { fill: 'F2F2F2' }), tc(p(String(kegiatan.length), { b: true, jc: 'center' }), w[6], { fill: 'F2F2F2' })]));
    }
    return tbl(w, rows);
  }

  async function laporan(o) {
    /* o: {jenis:'harian'|'realisasi'|'lengkap', profil, rhkList, kegiatan, ym, periode, tglTtd, foto:bool, getFoto:async id=>{data,w,h}} */
    const S = window.SKP; picId = 1; W = pageInfo(o.kop).W;
    const pr = o.profil || {}; const rhkMap = {}; o.rhkList.forEach(r => rhkMap[r.id] = r);
    const keg = o.kegiatan.slice().sort((a, b) => (a.tanggal + (a.jam || '') + a.dibuat).localeCompare(b.tanggal + (b.jam || '') + b.dibuat));
    const images = []; let body = '';
    // nomor lampiran
    const lampiranNo = {}; const lampiran = [];
    if (o.foto && o.jenis !== 'realisasi') {
      let n = 0;
      for (const k of keg) {
        const fotos = [];
        for (const id of (k.fotoIds || [])) { const f = await o.getFoto(id); if (f && f.data) fotos.push(f); }
        if (fotos.length) { n++; lampiranNo[k.id] = n; lampiran.push({ n, k, fotos }); }
      }
    }
    if (o.jenis === 'harian' || o.jenis === 'lengkap') {
      body += judul('LAPORAN KEGIATAN HARIAN', 'PERIODE ' + o.periode.toUpperCase());
      body += blokIdentitas(pr, o.periode) + p('', { after: 160 });
      body += tabelHarian(keg, rhkMap, lampiranNo);
      body += blokTtd(pr, o.tglTtd);
    }
    if (o.jenis === 'realisasi' || o.jenis === 'lengkap') {
      const jb = o.jenis === 'lengkap';
      body += p('CAPAIAN SASARAN KINERJA PEGAWAI (SKP)', { b: true, jc: 'center', sz: 26, pageBreak: jb }) + p('BULAN ' + S.namaBulan(o.ym).toUpperCase(), { b: true, jc: 'center', sz: 22, after: 200 });
      body += blokIdentitas(pr, S.namaBulan(o.ym)) + p('', { after: 160 });
      body += tabelRealisasi(o.rhkList, keg, o.ym);
      body += blokTtd(pr, o.tglTtd);
    }
    if (lampiran.length) {
      body += p('LAMPIRAN BUKTI DUKUNG KEGIATAN', { b: true, jc: 'center', sz: 24, after: 200, pageBreak: true });
      const EMU = 914400; const maxW = 3.0 * EMU, maxH = 2.6 * EMU; const cw = W / 2;
      const cells = [];
      for (const L of lampiran) {
        L.fotos.forEach((f, idx) => {
          const rId = 'rIdImg' + (images.length + 1);
          images.push({ rId, name: 'image' + (images.length + 1) + '.jpeg', bytes: dataUrlBytes(f.data) });
          const ratio = (f.w && f.h) ? f.w / f.h : 4 / 3; let w = maxW, h = w / ratio; if (h > maxH) { h = maxH; w = h * ratio; }
          const cap = 'Lampiran ' + L.n + (L.fotos.length > 1 ? String.fromCharCode(97 + idx) : '') + ' — ' + S.rentangTgl(L.k.tanggal, L.k.tanggalAkhir);
          cells.push(tc([p(img(rId, Math.round(w), Math.round(h)), { jc: 'center', before: 60, after: 60 }), p(cap, { b: true, sz: 18, jc: 'center' }), p((L.k.teks || '').slice(0, 160), { sz: 18, jc: 'center', after: 60 })], cw, { va: 'top' }));
        });
      }
      const rows = []; for (let i = 0; i < cells.length; i += 2) rows.push(tr([cells[i], cells[i + 1] || tc(p(''), cw)], { cantSplit: true }));
      body += tbl([cw, cw], rows, { borderColor: 'BFBFBF' });
    }
    return build(body, images, { kop: o.kop });
  }


  /* ---------- Bukti Dukung SKP: mengisi cetakan Word kantor (template-bukti-dukung.docx) ---------- */
  function imgNs(rId, wEmu, hEmu) {
    const n = picId++;
    return `<w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${wEmu}" cy="${hEmu}"/><wp:docPr id="${900 + n}" name="Foto ${n}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${900 + n}" name="foto${n}.jpeg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${wEmu}" cy="${hEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }
  const paraDengan = (xml, tanda) => { const re = new RegExp('<w:p(?: [^>]*)?>(?:(?!<w:p[ >])[\\s\\S])*?' + tanda + '[\\s\\S]*?</w:p>'); const m = xml.match(re); return m ? m[0] : null; };
  /* teks dengan baris baru → pindah baris di Word */
  const xBaris = t => String(t).split('\n').map(x).join('</w:t><w:br/><w:t xml:space="preserve">');
  /* Potongan <w:tr>…</w:tr> yang memuat teks tertentu */
  function barisDengan(d, teks) {
    const i = d.indexOf(teks); if (i < 0) return null;
    const a = Math.max(d.lastIndexOf('<w:tr>', i), d.lastIndexOf('<w:tr ', i)); const b = d.indexOf('</w:tr>', i);
    return a < 0 || b < 0 ? null : d.slice(a, b + 7);
  }
  async function buktiDukung(o) {
    /* o: {template, kop?, judul, nama, nip, bagian: [{rk, iki, items:[{teks, fotos:[{data,w,h}]}]}]}
       Tiap kegiatan = baris uraian diikuti baris fotonya.
       Setiap bagian (satu RK) menjadi satu blok sesuai cetakan, dimulai di halaman baru. */
    picId = 1;
    const z = await readZip(o.template);
    const asli = td(await z.get('word/document.xml'));
    let rels = td(await z.get('word/_rels/document.xml.rels'));
    let ct = td(await z.get('[Content_Types].xml'));
    const bagian = o.bagian && o.bagian.length ? o.bagian : [{ rk: o.rk, iki: o.iki, uraian: o.uraian || [], fotos: o.fotos || [] }];
    const i0 = asli.indexOf('<w:body>') + 8, i1 = asli.lastIndexOf('<w:sectPr');
    const blokAsli = asli.slice(i0, i1);
    const media = []; const EMU = 914400; const maxW = 4.6 * EMU, maxH = 3.0 * EMU; let nFoto = 0;
    const blok = bagian.map((bg, bi) => {
      let d = blokAsli;
      if (bi > 0) {   // salinan: nomor objek gambar unik & tanpa bookmark ganda
        d = d.replace(/(<wp:docPr [^>]*id=")(\d+)"/g, (m, p, n) => p + (Number(n) + 1000 * bi) + '"').replace(/(<(?:wps|pic):cNvPr [^>]*id=")(\d+)"/g, (m, p, n) => p + (Number(n) + 1000 * bi) + '"')
          .replace(/<w:bookmarkStart [^>]*\/>/g, '').replace(/<w:bookmarkEnd [^>]*\/>/g, '');
        // garis bawah kop (gambar) diganti garis paragraf agar tampil konsisten di halaman berikutnya
        const garis = paraDengan(d, '(?:mc:AlternateContent|wpg:wgp)');
        if (garis) d = d.replace(garis, '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" w:color="000000"/></w:pBdr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:ind w:left="-27"/></w:pPr></w:p>');
      }
      d = d.replace('{{JUDUL}}', x(o.judul)).replace('{{NAMA}}', x(o.nama)).replace('{{NIP}}', x(o.nip)).replace('{{RK}}', xBaris(bg.rk || '')).replace('{{IKI}}', xBaris(bg.iki || ''));
      // Baris uraian + baris foto diulang untuk setiap kegiatan: uraian 1, foto 1, uraian 2, foto 2, ...
      const items = bg.items || (bg.uraian || []).map((t, i) => ({ teks: t, fotos: i === 0 ? (bg.fotos || []) : [] }));
      const rowU = barisDengan(d, '{{URAIAN}}'), rowF = barisDengan(d, '{{FOTO}}');
      if (rowU && rowF) {
        const isi = (items.length ? items : [{ teks: '-', fotos: [] }]).map((it, i) => {
          let u = rowU.replace('{{NO}}. ', items.length ? (i + 1) + '. ' : '').replace('{{URAIAN}}', x(it.teks));
          const pf = paraDengan(rowF, '\\{\\{FOTO\\}\\}');
          let fx = '';
          (it.fotos || []).forEach((f, j) => {
            nFoto++; const rId = 'rIdFoto' + nFoto, name = 'bukti_foto' + nFoto + '.jpeg';
            media.push({ name: 'word/media/' + name, data: dataUrlBytes(f.data) });
            rels = rels.replace('</Relationships>', `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/></Relationships>`);
            const ratio = (f.w && f.h) ? f.w / f.h : 4 / 3; let w = maxW, h = w / ratio; if (h > maxH) { h = maxH; w = h * ratio; }
            fx += `<w:p><w:pPr><w:pStyle w:val="TableParagraph"/><w:spacing w:before="${j ? 60 : 120}"/><w:jc w:val="center"/></w:pPr>${imgNs(rId, Math.round(w), Math.round(h))}</w:p>`;
          });
          if (fx) fx += '<w:p><w:pPr><w:pStyle w:val="TableParagraph"/><w:spacing w:before="60"/><w:jc w:val="center"/></w:pPr></w:p>';
          else fx = '<w:p><w:pPr><w:pStyle w:val="TableParagraph"/><w:spacing w:before="120" w:after="120"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="808080"/><w:sz w:val="18"/></w:rPr><w:t>(tidak ada foto)</w:t></w:r></w:p>';
          // beberapa foto: baris foto boleh terpotong antarhalaman agar tidak menyisakan halaman kosong
          const rf = (it.fotos || []).length > 1 ? rowF.replace(/<w:cantSplit\/>/g, '') : rowF;
          return u + rf.replace(pf, fx);
        }).join('');
        d = d.replace(rowF, '').replace(rowU, isi);
      }
      return d;
    });
    // pemisah halaman: sisipkan di paragraf terakhir setiap blok kecuali blok terakhir
    for (let i = 0; i < blok.length - 1; i++) blok[i] = blok[i].replace(/<\/w:p>\s*$/, '<w:r><w:br w:type="page"/></w:r></w:p>');
    const doc = asli.slice(0, i0) + blok.join('') + asli.slice(i1);
    if (!/Extension="jpeg"/i.test(ct)) ct = ct.replace('<Default ', '<Default Extension="jpeg" ContentType="image/jpeg"/><Default ');
    // Kop surat unggahan admin menggantikan kop bawaan cetakan
    const ganti = {};
    if (o.kop && o.kop.headerXml) {
      const m = rels.match(/<Relationship [^>]*relationships\/header"[^>]*>/) || rels.match(/<Relationship [^>]*Type="[^"]*\/header"[^>]*>/);
      const tgt = m && (m[0].match(/Target="([^"]+)"/) || [])[1];
      if (tgt) {
        const hn = 'word/' + tgt.replace(/^\/?word\//, ''), hr = 'word/_rels/' + hn.split('/').pop() + '.rels';
        ganti[hn] = o.kop.headerXml; ganti[hr] = o.kop.hrels || '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';
        (o.kop.media || []).forEach(md => media.push({ name: 'word/media/' + md.name, data: unb64(md.b64) }));
        new Set((o.kop.media || []).map(md => md.name.split('.').pop().toLowerCase())).forEach(e => { if (!new RegExp('Extension="' + e + '"', 'i').test(ct)) ct = ct.replace('<Default ', `<Default Extension="${e}" ContentType="${MIME[e] || 'application/octet-stream'}"/><Default `); });
        if (o.kop.styles) {
          let st = td(await z.get('word/styles.xml'));
          const tambah = (o.kop.styles.match(/<w:style [\s\S]*?<\/w:style>/g) || []).filter(x => { const id = (x.match(/w:styleId="([^"]+)"/) || [])[1]; return id && !st.includes('w:styleId="' + id + '"'); }).join('');
          if (tambah) ganti['word/styles.xml'] = st.replace('</w:styles>', tambah + '</w:styles>');
        }
      }
    }
    const files = [];
    for (const n of z.names) {
      if (n === 'word/document.xml') files.push({ name: n, data: doc });
      else if (n === 'word/_rels/document.xml.rels') files.push({ name: n, data: rels });
      else if (n === '[Content_Types].xml') files.push({ name: n, data: ct });
      else if (ganti[n] != null) { files.push({ name: n, data: ganti[n] }); delete ganti[n]; }
      else if (!n.endsWith('/')) files.push({ name: n, data: await z.get(n) });
    }
    Object.entries(ganti).forEach(([n, d]) => files.push({ name: n, data: d }));
    return zip(files.concat(media));
  }


  /* ---------- Laporan Perjalanan Dinas (pengawasan / pendataan lapangan) ----------
     o: {template, jenis, nomor, tglSt, nama, periode, baris:[{tanggal, uraian, masalah, solusi}],
         tempatTgl, jabatan, ketua, petugas, fotos:[{data,w,h,ket}]} */
  async function laporanDinas(o) {
    picId = 1;
    const z = await readZip(o.template);
    const asli = td(await z.get('word/document.xml'));
    let rels = td(await z.get('word/_rels/document.xml.rels'));
    let ct = td(await z.get('[Content_Types].xml'));
    const F = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="000000"/>';
    const R = (t, sz, extra = '') => `<w:r><w:rPr>${F}${extra}${sz ? `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>` : ''}</w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
    const P = (isi, ppr = '') => `<w:p><w:pPr>${ppr}</w:pPr>${isi}</w:p>`;
    const TAB = sz => `<w:r><w:rPr>${F}${sz ? `<w:sz w:val="${sz}"/>` : ''}</w:rPr><w:tab/></w:r>`;
    const sp0 = '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>';
    let b = '';
    // Judul
    // dua baris kosong agar judul tidak menempel/tertutup kop
    const kosong = P('<w:r><w:rPr>' + F + '<w:sz w:val="20"/></w:rPr></w:r>', sp0 + '<w:rPr><w:sz w:val="20"/></w:rPr>');
    b += kosong + kosong;
    b += P(R('LAPORAN PERJALANAN DINAS ' + String(o.jenis || '').toUpperCase(), 20), sp0 + '<w:jc w:val="right"/>');
    b += P('', sp0);
    // Identitas
    [['Nomor Surat Tugas', o.nomor], ['Tanggal Surat Tugas', o.tglSt], ['Nama Petugas', o.nama], ['Periode Penugasan', o.periode]].forEach(([l, v]) =>
      b += P(R(l, 20) + TAB(20) + R(': ' + (v || ''), 20), '<w:tabs><w:tab w:val="left" w:pos="2410"/></w:tabs><w:spacing w:after="0"/><w:ind w:left="2552" w:hanging="2552"/>'));
    b += P('', sp0);
    // Tabel kegiatan
    const lebar = [523, 1178, 2929, 2360, 2360];
    const sel = (i, isi, jc = 'both') => `<w:tc><w:tcPr><w:tcW w:w="${lebar[i]}" w:type="dxa"/></w:tcPr>${isi || P('', sp0 + `<w:jc w:val="${jc}"/>`)}</w:tc>`;
    const teksSel = (t, jc = 'both') => P(R(t, 20), '<w:spacing w:after="0"/>' + `<w:jc w:val="${jc}"/>`);
    // teks bebas: baris diawali "-", "•", atau "*" menjadi butir; baris lain paragraf biasa
    const blokTeks = t => {
      const L = String(t || '').split(/\r?\n/).map(s => s.trimEnd()).filter((s, i, a) => s.trim() || (i && i < a.length - 1));
      if (!L.length) return '';
      return L.map(s => { const m = s.match(/^\s*[-•*]\s+(\S.*)$/);
        return m ? P(R(m[1], 20), '<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="24"/></w:numPr><w:spacing w:after="0"/><w:ind w:left="360" w:hanging="270"/><w:jc w:val="left"/>')
          : P(R(s, 20), '<w:spacing w:after="0"/><w:jc w:val="both"/>'); }).join('');
    };
    const kepala = ['No', 'Tanggal', 'Uraian Kegiatan', 'Permasalahan', 'Solusi'];
    let tb = `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="9350" w:type="dxa"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>${lebar.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
    tb += '<w:tr><w:trPr><w:tblHeader/></w:trPr>' + kepala.map((h, i) => sel(i, teksSel(h, 'center'))).join('') + '</w:tr>';
    tb += '<w:tr><w:trPr><w:tblHeader/></w:trPr>' + kepala.map((h, i) => sel(i, teksSel('(' + (i + 1) + ')', 'center'))).join('') + '</w:tr>';
    (o.baris && o.baris.length ? o.baris : [{}]).forEach((r, i) => {
      tb += '<w:tr><w:trPr><w:trHeight w:val="1200"/></w:trPr>' + sel(0, teksSel(o.baris && o.baris.length ? String(i + 1) : '', 'left')) + sel(1, teksSel(r.tanggal || '', 'left')) +
        sel(2, blokTeks(r.uraian)) + sel(3, blokTeks(r.masalah)) + sel(4, blokTeks(r.solusi || (o.baris && o.baris.length ? '-' : ''))) + '</w:tr>';
    });
    tb += '</w:tbl>';
    b += tb;
    // Tanda tangan (kolom kiri: Mengetahui / Ketua Tim; kanan: Petugas)
    const tabsTtd = '<w:tabs><w:tab w:val="center" w:pos="1843"/><w:tab w:val="center" w:pos="7230"/></w:tabs><w:spacing w:after="0" w:line="240" w:lineRule="auto"/>';
    b += P('', sp0);
    b += P(TAB() + TAB() + R(o.tempatTgl || ''), tabsTtd + '<w:keepNext/>');
    b += P(TAB() + R('Mengetahui'), tabsTtd + '<w:keepNext/>');
    b += P(TAB() + R(o.jabatan || '') + TAB() + R('Petugas'), tabsTtd + '<w:keepNext/>');
    for (let i = 0; i < 4; i++) b += P('', tabsTtd + '<w:keepNext/>');
    b += P(TAB() + R(o.ketua || '') + TAB() + R(o.petugas || ''), tabsTtd);
    // Lampiran dokumentasi: 2 foto per baris
    const fotos = o.fotos || [];
    if (fotos.length) {
      b += P('<w:r><w:br w:type="page"/></w:r>', sp0);
      b += P(R('Lampiran Dokumentasi'), '<w:spacing w:after="160"/>');
      const EMU = 914400, maxW = 2.85 * EMU, maxH = 2.6 * EMU; const media = [];
      const sel2 = isi => `<w:tc><w:tcPr><w:tcW w:w="4675" w:type="dxa"/></w:tcPr>${isi}</w:tc>`;
      let ft = `<w:tbl><w:tblPr><w:tblW w:w="9350" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="4675"/><w:gridCol w:w="4675"/></w:tblGrid>`;
      for (let i = 0; i < fotos.length; i += 2) {
        ft += '<w:tr><w:trPr><w:cantSplit/></w:trPr>';
        for (let j = i; j < i + 2; j++) {
          const f = fotos[j];
          if (!f) { ft += sel2(P('', sp0)); continue; }
          const rId = 'rIdLpd' + (j + 1), nm = 'lpd_foto' + (j + 1) + '.jpeg';
          media.push({ name: 'word/media/' + nm, data: dataUrlBytes(f.data) });
          rels = rels.replace('</Relationships>', `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${nm}"/></Relationships>`);
          const ratio = (f.w && f.h) ? f.w / f.h : 4 / 3; let w = maxW, h = w / ratio; if (h > maxH) { h = maxH; w = h * ratio; }
          ft += sel2(P(imgNs(rId, Math.round(w), Math.round(h)), '<w:spacing w:before="120" w:after="40"/><w:jc w:val="center"/>') +
            (f.ket ? P(R(f.ket, 16, '<w:i/>'), '<w:spacing w:after="160"/><w:jc w:val="center"/>') : P('', '<w:spacing w:after="120"/>')));
        }
        ft += '</w:tr>';
      }
      b += ft + '</w:tbl>';
      if (!/Extension="jpeg"/i.test(ct)) ct = ct.replace('<Default ', '<Default Extension="jpeg" ContentType="image/jpeg"/><Default ');
      o._media = media;
    }
    // paragraf penanda {{ISI}} (Word bisa memecah teksnya menjadi beberapa bagian)
    let doc = asli, ketemu = false;
    doc = doc.replace(/<w:p(?: [^>]*[^/])?>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g, p => { if (ketemu) return p; const t = (p.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g) || []).map(x => x.replace(/<[^>]+>/g, '')).join(''); if (t.includes('{{ISI}}')) { ketemu = true; return b; } return p; });
    if (!ketemu) { const i = doc.lastIndexOf('<w:sectPr'); doc = doc.slice(0, i) + b + doc.slice(i); }
    // Kop & footer unggahan admin (khusus laporan perjalanan dinas)
    const ganti = {}, tambahMedia = [];
    const pasangMedia = list => (list || []).forEach(md => { tambahMedia.push({ name: 'word/media/' + md.name, data: unb64(md.b64) }); const e = md.name.split('.').pop().toLowerCase(); if (!new RegExp('Extension="' + e + '"', 'i').test(ct)) ct = ct.replace('<Default ', `<Default Extension="${e}" ContentType="${MIME[e] || 'application/octet-stream'}"/><Default `); });
    let gayaTambah = '';
    if (o.kop && o.kop.xml) {
      const m = rels.match(/<Relationship [^>]*\/header"[^>]*>/); const tgt = m && (m[0].match(/Target="([^"]+)"/) || [])[1];
      if (tgt) { const hn = 'word/' + tgt.replace(/^\/?word\//, ''); ganti[hn] = o.kop.xml; ganti['word/_rels/' + hn.split('/').pop() + '.rels'] = o.kop.rels || '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'; pasangMedia(o.kop.media); gayaTambah += o.kop.styles || ''; }
    }
    if (o.footer && o.footer.xml) {
      ganti['word/footer_dinas.xml'] = o.footer.xml; ganti['word/_rels/footer_dinas.xml.rels'] = o.footer.rels || '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';
      rels = rels.replace('</Relationships>', '<Relationship Id="rIdFooterDinas" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer_dinas.xml"/></Relationships>');
      ct = ct.replace('</Types>', '<Override PartName="/word/footer_dinas.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>');
      doc = doc.replace(/<w:footerReference[^>]*\/>/g, '').replace(/(<w:headerReference[^>]*\/>)/, '$1<w:footerReference w:type="default" r:id="rIdFooterDinas"/>');
      pasangMedia(o.footer.media); gayaTambah += o.footer.styles || '';
    }
    if (gayaTambah) {
      const st = td(await z.get('word/styles.xml'));
      const tambah = (gayaTambah.match(/<w:style [\s\S]*?<\/w:style>/g) || []).filter((g, i, arr) => { const id = (g.match(/w:styleId="([^"]+)"/) || [])[1]; return id && !st.includes('w:styleId="' + id + '"') && arr.findIndex(y => y.includes('w:styleId="' + id + '"')) === i; }).join('');
      if (tambah) ganti['word/styles.xml'] = st.replace('</w:styles>', tambah + '</w:styles>');
    }
    const files = [];
    for (const n of z.names) {
      if (n === 'word/document.xml') files.push({ name: n, data: doc });
      else if (n === 'word/_rels/document.xml.rels') files.push({ name: n, data: rels });
      else if (n === '[Content_Types].xml') files.push({ name: n, data: ct });
      else if (ganti[n] != null) { files.push({ name: n, data: ganti[n] }); delete ganti[n]; }
      else if (!n.endsWith('/')) files.push({ name: n, data: await z.get(n) });
    }
    Object.entries(ganti).forEach(([n, d]) => files.push({ name: n, data: d }));
    return zip(files.concat(o._media || [], tambahMedia));
  }
  window.DOCX = { build, zip, p, run, tc, tr, tbl, img, laporan, extractKop, extractBagian, buktiDukung, laporanDinas, zipBerkas: files => { const b = zip(files); return new Blob([b], { type: 'application/zip' }); } };
})();
