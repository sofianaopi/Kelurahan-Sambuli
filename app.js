/**
 * Website Kelurahan Tondonggeu — versi statis (HTML/CSS/JS murni, tanpa server).
 * Data diambil langsung dari Google Sheets (harus di-share "Anyone with the link – Viewer"),
 * lewat endpoint ekspor CSV bawaan Google (gviz). Semua render terjadi di browser (client-side),
 * jadi setelah data sebuah kategori dimuat sekali, pindah-pindah menu jadi INSTAN (tidak reload).
 *
 * Ganti KE SPREADSHEET LAIN cukup ganti SPREADSHEET_ID di bawah — struktur sheet & kolomnya
 * harus sama persis dengan yang dibuat Setup.gs pada versi Apps Script proyek ini.
 */
(function () {
  "use strict";

  var SPREADSHEET_ID = "1GuY0nHpmPzdaVEUs1t7vpRe1qqRMNCrmBTRWM-QKRnw";

  var DATA_CATEGORIES = {
    pemerintahan: { label: "Pemerintahan", icon: "🏛️", build: buildPemerintahan },
    kependudukan: { label: "Kependudukan", icon: "👨‍👩‍👧‍👦", build: buildKependudukan },
    pendidikan: { label: "Pendidikan", icon: "🎓", build: buildPendidikan },
    kesehatan: { label: "Kesehatan", icon: "🏥", build: buildKesehatan },
    sosial: { label: "Sosial & Keamanan", icon: "🕌", build: buildSosial },
    ekonomi: { label: "Ekonomi", icon: "🏪", build: buildEkonomi },
    keuangan: { label: "Keuangan", icon: "💰", build: buildKeuangan },
    infrastruktur: { label: "Infrastruktur", icon: "🛣️", build: buildInfrastruktur }
  };

  var TOP_PAGES = [
    { key: "beranda", label: "Beranda" },
    { key: "berita", label: "Berita" },
    { key: "infografis", label: "Infografis" },
    { key: "data", label: "Data" },
    {
      key: "unduh", label: "Unduh",
      children: [
        { label: "Unduh Data", href: "#/unduh" },
        { label: "Unduh Profil", href: "#/unduh-profil" },
        { label: "Unduh Publikasi", href: "#/unduh-publikasi" }
      ]
    },
    { key: "permintaan", label: "Ajukan Permintaan Data" }
  ];

  /** Nomor WhatsApp pihak kelurahan tujuan pengiriman formulir permintaan data. */
  var WA_NUMBER = "6285241827228"; // dari 089526668146, format wa.me: kode negara 62 + tanpa angka 0 di depan

  var DOWNLOADABLE_SHEETS = [
    ["Jumlah Penduduk menurut Jenis Kelamin", "PendudukGender"],
    ["Jumlah Penduduk per RT/SLS", "PendudukPerRT"],
    ["Jumlah Keluarga per Tahun", "JumlahKeluarga"],
    ["Jumlah Perangkat Kelurahan", "Perangkat"],
    ["Lembaga Kemasyarakatan", "Lembaga"],
    ["Sarana Pendidikan", "Pendidikan"],
    ["Sarana Kesehatan", "FasilitasKesehatan"],
    ["Tenaga Kesehatan", "TenagaKesehatan"],
    ["Kejadian Luar Biasa Penyakit", "KLB"],
    ["Tempat Ibadah", "TempatIbadah"],
    ["Keragaman Agama, Etnis & Bahasa", "Keragaman"],
    ["Kondisi Bangunan Rumah", "KondisiBangunan"],
    ["Data Disabilitas", "Disabilitas"],
    ["Upaya Keamanan Lingkungan", "Keamanan"],
    ["Tindak Kejahatan Setahun Terakhir", "TindakKejahatan"],
    ["Data UMKM", "UMKM"],
    ["Sarana Penunjang Ekonomi", "SaranaPenunjangEkonomi"],
    ["Industri Kecil & Mikro", "IndustriKecilMikro"],
    ["Realisasi Belanja Kelurahan", "Keuangan"],
    ["Kejadian Bencana Alam", "Bencana"],
    ["Transportasi & Angkutan Umum", "Transportasi"],
    ["Komunikasi & Informasi", "Komunikasi"],
    ["Listrik & Penerangan Jalan", "Perumahan"]
  ];

  var COLORS = ["#2563a8", "#e07a9b", "#2f8a5c", "#c9a227", "#7a5cff", "#1f6f4a"];

  /** Struktur organisasi & kepegawaian — data statis dari papan struktur kantor (bukan dari Sheet). */
  var STRUKTUR_ORGANISASI = [
  {
    nama: "Muchlis Afriyandi, SH",
    jenis_kelamin: "laki-laki",
    jabatan: "Lurah"
  },
  {
    nama: "Sri Suwardi, S.Ip",
    jenis_kelamin: "Perempuan",
    jabatan: "Kasi Ketentraman dan Ketertibah Umum"
  },
  {
    nama: "Asriady Asdar, ST",
    jenis_kelamin: "Laki-laki",
    jabatan: "Kasi Pemerintah dan Pelayanan Publik"
  },
  {
    nama: "Yusuf, SE",
    jenis_kelamin: "Laki-laki",
    jabatan: "kasi Pembangunan dan Pemberdayaan Masyarakat"
  },
  {
    nama: "Sri Endang",
    jenis_kelamin: "Perempuan",
    jabatan: "Staf PPPK"
  },
  {
    nama: "Rasmin",
    jenis_kelamin: "Laki-laki",
    jabatan: "Staf PPPK"
  },
  {
    nama: "Rosmiati",
    jenis_kelamin: "Perempuan",
    jabatan: "Staf PPPK"
  },
{
    nama: "Qhomariah",
    jenis_kelamin: "Perempuan",
    jabatan: "Staf PPPK"
  }
];

  /* ---------------------------------------------------------------------
   * Ambil & cache data dari Google Sheets (endpoint ekspor CSV / gviz)
   * ------------------------------------------------------------------- */
  var rawCache = {};
  var objCache = {};
  var configCache = null;

  function csvUrl(sheetName) {
    /* headers=1 wajib ada — tanpa ini, gviz kadang salah tebak baris header untuk sheet
       2 kolom yang isinya teks pendek (mis. Config), dan menggabung beberapa baris pertama
       jadi satu baris yang rusak. */
    return (
      "https://docs.google.com/spreadsheets/d/" +
      SPREADSHEET_ID +
      "/gviz/tq?tqx=out:csv&headers=1&sheet=" +
      encodeURIComponent(sheetName)
    );
  }

  function fetchSheetRaw(sheetName) {
    if (!rawCache[sheetName]) {
      rawCache[sheetName] = fetch(csvUrl(sheetName)).then(function (res) {
        if (!res.ok) {
          throw new Error(
            'Sheet "' + sheetName + '" tidak bisa dibaca (status ' + res.status + "). " +
            'Pastikan Google Sheet database sudah di-share sebagai "Anyone with the link – Viewer".'
          );
        }
        return res.text();
      });
    }
    return rawCache[sheetName];
  }

  function fetchSheet(sheetName) {
    if (!objCache[sheetName]) {
      objCache[sheetName] = fetchSheetRaw(sheetName).then(csvToObjects);
    }
    return objCache[sheetName];
  }

  function getConfig() {
    if (configCache) return configCache;
    configCache = fetchSheet("Config").then(function (rows) {
      var cfg = {};
      rows.forEach(function (r) {
        cfg[r.Key] = r.Value;
      });
      return cfg;
    });
    return configCache;
  }

  /** Parser CSV sederhana tapi benar (menangani field berkutip dengan koma/baris baru di dalamnya). */
  function parseCsvRows(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\r") {
        /* dilewati */
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  /** Ubah teks angka jadi Number kalau memang murni angka (menjaga kode dengan nol di depan sbg teks). */
  function coerceValue(raw) {
    if (raw === "") return "";
    var cleaned = raw.replace(/,/g, "");
    if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(cleaned)) return Number(cleaned);
    return raw;
  }

  function csvToObjects(text) {
    var rows = parseCsvRows(text).filter(function (r) {
      return r.length > 1 || (r.length === 1 && r[0] !== "");
    });
    if (!rows.length) return [];
    var headers = rows[0];
    return rows.slice(1).map(function (r) {
      var obj = {};
      headers.forEach(function (h, i) {
        obj[h] = coerceValue(r[i] === undefined ? "" : r[i]);
      });
      return obj;
    });
  }

  /* ---------------------------------------------------------------------
   * Helper tampilan (sama filosofinya dengan versi Apps Script)
   * ------------------------------------------------------------------- */
  function esc(s) {
    return String(s === undefined || s === null ? "" : s).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }

  function rupiah(n) {
    n = Number(n) || 0;
    return "Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
  }

  function table(headers, rows, numCols) {
    numCols = numCols || [];
    var h =
      '<div class="table-wrap"><table><thead><tr>' +
      headers
        .map(function (x, i) {
          return '<th class="' + (numCols.indexOf(i) > -1 ? "num" : "") + '">' + esc(x) + "</th>";
        })
        .join("") +
      "</tr></thead><tbody>";
    rows.forEach(function (r) {
      h +=
        "<tr>" +
        r
          .map(function (c, i) {
            return '<td class="' + (numCols.indexOf(i) > -1 ? "num" : "") + '">' + c + "</td>";
          })
          .join("") +
        "</tr>";
    });
    h += "</tbody></table></div>";
    return h;
  }

  function bars(data, opts) {
    opts = opts || {};
    var w = 380,
      h = opts.horizontal ? Math.max(120, data.length * 34 + 10) : 220;
    var max = Math.max.apply(null, data.map(function (d) { return d.v; })) || 1;
    var pad = 8;
    var svg = '<svg viewBox="0 0 ' + w + " " + h + '" width="100%" role="img" aria-label="grafik batang">';
    if (opts.horizontal) {
      var bh = (h - pad * 2) / data.length;
      data.forEach(function (d, i) {
        var bw = (d.v / max) * (w - 150);
        var y = pad + i * bh;
        svg += '<text x="0" y="' + (y + bh / 2 + 4) + '" font-size="11" fill="var(--muted)">' + esc(d.k) + "</text>";
        svg +=
          '<rect x="146" y="' + (y + bh * 0.18) + '" width="' + Math.max(bw, 2) + '" height="' + bh * 0.64 +
          '" rx="4" fill="' + (opts.color || "var(--green-600)") + '"></rect>';
        svg += '<text x="' + (150 + bw) + '" y="' + (y + bh / 2 + 4) + '" font-size="11" fill="var(--ink)" font-weight="600">' + d.v + "</text>";
      });
    } else {
      var bw2 = (w - pad * 2) / data.length;
      data.forEach(function (d, i) {
        var bh2 = (d.v / max) * (h - 40);
        var x = pad + i * bw2 + bw2 * 0.15;
        svg +=
          '<rect x="' + x + '" y="' + (h - 24 - bh2) + '" width="' + bw2 * 0.7 + '" height="' + Math.max(bh2, 2) +
          '" rx="4" fill="' + (opts.colors ? opts.colors[i % opts.colors.length] : opts.color || "var(--green-600)") + '"></rect>';
        svg += '<text x="' + (x + bw2 * 0.35) + '" y="' + (h - 24 - bh2 - 6) + '" font-size="11" font-weight="700" text-anchor="middle" fill="var(--ink)">' + d.v + "</text>";
        svg += '<text x="' + (x + bw2 * 0.35) + '" y="' + (h - 6) + '" font-size="10" text-anchor="middle" fill="var(--muted)">' + esc(d.k) + "</text>";
      });
    }
    svg += "</svg>";
    return svg;
  }

  function donut(data, opts) {
    opts = opts || {};
    var r = 60,
      cx = 80,
      cy = 80,
      circ = 2 * Math.PI * r;
    var total = data.reduce(function (s, d) { return s + d.v; }, 0) || 1;
    var offset = 0;
    var svg = '<svg viewBox="0 0 160 160" width="100%" style="max-width:200px;display:block;margin:0 auto" role="img" aria-label="grafik lingkaran">';
    svg += '<g transform="rotate(-90 80 80)">';
    data.forEach(function (d, i) {
      var len = (d.v / total) * circ;
      svg +=
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' +
        (opts.colors ? opts.colors[i % opts.colors.length] : COLORS[i % COLORS.length]) +
        '" stroke-width="26" stroke-dasharray="' + len + " " + (circ - len) + '" stroke-dashoffset="' + -offset + '"></circle>';
      offset += len;
    });
    svg += "</g>";
    svg += '<text x="80" y="76" text-anchor="middle" font-size="20" font-weight="700" fill="var(--ink)">' + total + "</text>";
    svg += '<text x="80" y="94" text-anchor="middle" font-size="10" fill="var(--muted)">total</text>';
    svg += "</svg>";
    return svg;
  }

  function legend(data, opts) {
    opts = opts || {};
    return (
      '<div class="legend">' +
      data
        .map(function (d, i) {
          var c = opts.colors ? opts.colors[i % opts.colors.length] : COLORS[i % COLORS.length];
          return '<span><span class="legend-dot" style="background:' + c + '"></span>' + esc(d.k) + " — " + d.v + "</span>";
        })
        .join("") +
      "</div>"
    );
  }

  function pageHero(title, sub) {
    return '<section class="hero page-hero"><div class="hero-inner"><h1>' + esc(title) + "</h1>" + (sub ? "<p>" + esc(sub) + "</p>" : "") + "</div></section>";
  }

  /** Galeri foto geser (swipe) — slides: [{src, caption}, ...]. Kalau cuma 1 foto, tombol/dot disembunyikan. */
  function photoSlider(sliderId, slides) {
    var imgs = slides
      .map(function (s) {
        return '<img class="profile-photo" src="' + esc(s.src) + '" alt="' + esc(s.caption) + '" data-lightbox="' + esc(s.src) + '">';
      })
      .join("");
    var nav =
      slides.length > 1
        ? '<button class="photo-slider-btn prev" type="button" data-slider-prev aria-label="Foto sebelumnya">‹</button>' +
          '<button class="photo-slider-btn next" type="button" data-slider-next aria-label="Foto berikutnya">›</button>'
        : "";
    var dots =
      slides.length > 1
        ? '<div class="photo-slider-dots">' +
          slides
            .map(function (s, i) {
              return '<button class="photo-slider-dot' + (i === 0 ? " active" : "") + '" type="button" data-slider-dot="' + i + '" aria-label="Foto ' + (i + 1) + '"></button>';
            })
            .join("") +
          "</div>"
        : "";
    return (
      '<div class="photo-slider" id="' + esc(sliderId) + '" data-slider>' +
      '<div class="photo-slider-viewport"><div class="photo-slider-track">' + imgs + "</div>" + nav + "</div>" +
      '<p class="profile-photo-caption" data-slider-caption>' + esc(slides[0].caption) + "</p>" +
      dots +
      "</div>"
    );
  }

  /** Filter baris (yang sudah punya kolom Tahun) ke 1 tahun; kosong/tak ketemu -> tahun terbaru. */
  function filterByYear(rows, tahun) {
    var years = rows
      .map(function (r) { return Number(r.Tahun); })
      .filter(function (v, i, a) { return !isNaN(v) && a.indexOf(v) === i; })
      .sort(function (a, b) { return b - a; });
    var target = tahun && years.indexOf(Number(tahun)) > -1 ? Number(tahun) : years[0];
    return {
      tahun: target,
      years: years,
      rows: rows.filter(function (r) { return Number(r.Tahun) === target; })
    };
  }

  function unionYears(rowArrays) {
    var years = {};
    rowArrays.forEach(function (rows) {
      rows.forEach(function (r) {
        if (r.Tahun) years[Number(r.Tahun)] = true;
      });
    });
    return Object.keys(years)
      .map(Number)
      .sort(function (a, b) { return b - a; });
  }

  /** navPath: path hash tujuan tanpa "#/", mis. "data/pemerintahan" atau "unduh". */
  function yearPicker(navPath, years, activeYear, label) {
    label = label || "Tahun data";
    var safeId = navPath.replace(/[^a-z0-9]/gi, "-");
    var opts = years
      .map(function (y) {
        return '<option value="' + y + '"' + (y === activeYear ? " selected" : "") + ">" + y + "</option>";
      })
      .join("");
    return (
      '<div class="year-picker"><label for="ys-' + safeId + '">' + label + "</label>" +
      '<select id="ys-' + safeId + '" data-year-nav="' + esc(navPath) + '">' + opts + "</select>" +
      "</div>"
    );
  }

  /* ---------------------------------------------------------------------
   * Router (hash-based) — #/beranda, #/data/pemerintahan?tahun=2026, dst.
   * ------------------------------------------------------------------- */
  function parseHash() {
    var hash = location.hash.replace(/^#\/?/, "");
    var qIndex = hash.indexOf("?");
    var path = qIndex === -1 ? hash : hash.slice(0, qIndex);
    var query = {};
    if (qIndex !== -1) {
      hash
        .slice(qIndex + 1)
        .split("&")
        .forEach(function (kv) {
          var parts = kv.split("=");
          if (parts[0]) query[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || "");
        });
    }
    var segments = path.split("/").filter(Boolean);
    return { page: segments[0] || "beranda", sub: segments[1] || "", query: query };
  }

  /** Timer auto-geser galeri foto — dikumpulkan di sini supaya bisa dimatikan begitu pindah halaman. */
  var sliderTimers = [];
  function stopPhotoSliders() {
    sliderTimers.forEach(function (t) { clearInterval(t); });
    sliderTimers = [];
  }

  async function render() {
    stopPhotoSliders();
    var r = parseHash();
    var app = document.getElementById("app");
    app.innerHTML = '<div class="loading-box"><div class="spinner"></div>Memuat data…</div>';
    try {
      var html;
      var validKeys = TOP_PAGES.map(function (p) { return p.key; }).concat(["unduh-profil", "unduh-publikasi"]);
      var pageKey = validKeys.indexOf(r.page) > -1 ? r.page : "beranda";
      if (pageKey === "data") html = await buildDataPage(r.sub, r.query.tahun);
      else if (pageKey === "infografis") html = await buildInfografis(r.query.tahun);
      else if (pageKey === "berita") html = await buildBerita();
      else if (pageKey === "unduh") html = await buildUnduh(r.query.tahun);
      else if (pageKey === "unduh-profil") html = await buildUnduhProfil(r.query.tahun);
      else if (pageKey === "unduh-publikasi") html = await buildUnduhPublikasi(r.query.tahun);
      else if (pageKey === "permintaan") html = await buildPermintaan();
      else html = await buildProfil();
      app.innerHTML = html;
      wireLocalClicks(app);
      updateNavActive(pageKey);
      window.scrollTo({ top: 0 });
    } catch (err) {
      app.innerHTML =
        '<div class="container"><div class="error-box"><strong>Gagal memuat data.</strong><br>' +
        esc(err.message) +
        "</div></div>";
    }
  }

  function wireLocalClicks(scopeEl) {
    scopeEl.querySelectorAll("[data-year-nav]").forEach(function (el) {
      el.addEventListener("change", function () {
        location.hash = "#/" + el.getAttribute("data-year-nav") + "?tahun=" + el.value;
      });
    });
    scopeEl.querySelectorAll("[data-toggle]").forEach(function (el) {
      el.addEventListener("click", function () {
        var body = document.getElementById(el.getAttribute("data-toggle"));
        var open = body.classList.toggle("open");
        el.textContent = open ? "Sembunyikan ▴" : "Baca Selengkapnya ▾";
      });
    });
    scopeEl.querySelectorAll("[data-download]").forEach(function (el) {
      el.addEventListener("click", function () {
        downloadSheet(el.getAttribute("data-download"), el);
      });
    });
    scopeEl.querySelectorAll("[data-download-pdf]").forEach(function (el) {
      el.addEventListener("click", function () {
        downloadSheetPdf(el.getAttribute("data-download-pdf"), el);
      });
    });
    scopeEl.querySelectorAll("[data-download-docx]").forEach(function (el) {
      el.addEventListener("click", function () {
        downloadSheetDocx(el.getAttribute("data-download-docx"), el);
      });
    });
    scopeEl.querySelectorAll("[data-print]").forEach(function (el) {
      el.addEventListener("click", function () { window.print(); });
    });
    scopeEl.querySelectorAll("[data-lightbox]").forEach(function (el) {
      el.addEventListener("click", function () {
        openLightbox(el.getAttribute("data-lightbox"), el.alt || "");
      });
    });
    var permintaanForm = scopeEl.querySelector("#permintaan-form");
    if (permintaanForm) permintaanForm.addEventListener("submit", handlePermintaanSubmit);
    initPhotoSliders(scopeEl);
  }

  /** Aktifkan galeri foto geser: tombol ‹›, dot, dan geser sentuh/drag mouse (Pointer Events). */
  function initPhotoSliders(scopeEl) {
    scopeEl.querySelectorAll("[data-slider]").forEach(function (root) {
      var track = root.querySelector(".photo-slider-track");
      var imgs = Array.prototype.slice.call(track.children);
      var total = imgs.length;
      if (total < 2) return;
      var index = 0;
      var captionEl = root.querySelector("[data-slider-caption]");
      var dots = Array.prototype.slice.call(root.querySelectorAll("[data-slider-dot]"));
      var captions = imgs.map(function (img) { return img.alt; });

      function goTo(i) {
        index = (i + total) % total;
        track.style.transform = "translateX(-" + index * 100 + "%)";
        if (captionEl) captionEl.textContent = captions[index];
        dots.forEach(function (d, di) { d.classList.toggle("active", di === index); });
      }

      /* Geser otomatis tiap 5 detik; direset setiap kali pengguna geser manual (tombol/dot/swipe)
         supaya tidak "loncat" tanggung tepat setelah interaksi manual. */
      var autoplayTimer = null;
      function startAutoplay() {
        stopAutoplay();
        autoplayTimer = setInterval(function () { goTo(index + 1); }, 5000);
        sliderTimers.push(autoplayTimer);
      }
      function stopAutoplay() {
        if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null; }
      }
      function goToManual(i) { goTo(i); startAutoplay(); }

      var prevBtn = root.querySelector("[data-slider-prev]");
      var nextBtn = root.querySelector("[data-slider-next]");
      if (prevBtn) prevBtn.addEventListener("click", function () { goToManual(index - 1); });
      if (nextBtn) nextBtn.addEventListener("click", function () { goToManual(index + 1); });
      dots.forEach(function (d) {
        d.addEventListener("click", function () { goToManual(Number(d.getAttribute("data-slider-dot"))); });
      });
      root.addEventListener("mouseenter", stopAutoplay);
      root.addEventListener("mouseleave", startAutoplay);
      startAutoplay();

      /* Geser pakai Pointer Events -> satu kode jalan untuk sentuhan (HP) maupun drag mouse.
         "moved" dipakai supaya klik-untuk-zoom (lightbox) tidak ikut kepicu tepat setelah geser. */
      var viewport = root.querySelector(".photo-slider-viewport");
      var startX = null, dragging = false, moved = false;
      viewport.addEventListener("pointerdown", function (e) {
        if (e.target.closest(".photo-slider-btn")) return; // biar tombol ‹ › tetap bisa diklik normal
        startX = e.clientX;
        dragging = true;
        moved = false;
        viewport.setPointerCapture(e.pointerId);
      });
      viewport.addEventListener("pointermove", function (e) {
        if (dragging && Math.abs(e.clientX - startX) > 10) moved = true;
      });
      viewport.addEventListener("pointerup", function (e) {
        if (!dragging) return;
        dragging = false;
        var diff = e.clientX - startX;
        if (Math.abs(diff) > 40) goToManual(diff < 0 ? index + 1 : index - 1);
      });
      viewport.addEventListener(
        "click",
        function (e) {
          if (moved) { e.preventDefault(); e.stopPropagation(); }
          moved = false;
        },
        true
      );
    });
  }

  /** Lightbox sederhana: klik gambar bertanda [data-lightbox] untuk lihat versi besar. */
  function openLightbox(src, alt) {
    var overlay = document.createElement("div");
    overlay.className = "lightbox-overlay";
    overlay.innerHTML = '<img src="' + esc(src) + '" alt="' + esc(alt) + '">';
    overlay.addEventListener("click", function () { overlay.remove(); });
    document.body.appendChild(overlay);
  }

  function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function downloadSheet(sheetName, btn) {
    var original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Menyiapkan…";
    var yearValue = btn.getAttribute("data-year") || "all";

    fetchSheet(sheetName)
      .then(function (rows) {
        var filtered = yearValue === "all" ? rows : rows.filter(function (r) { return String(r.Tahun) === yearValue; });
        if (!filtered.length) filtered = rows; // jaga-jaga kalau ternyata kosong
        var headers = filtered.length ? Object.keys(filtered[0]) : [];
        var aoa = [headers].concat(
          filtered.map(function (r) { return headers.map(function (h) { return r[h]; }); })
        );
        var ws = XLSX.utils.aoa_to_sheet(aoa);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        var suffix = yearValue === "all" ? "" : "-" + yearValue;
        XLSX.writeFile(wb, slugify(sheetName) + suffix + ".xlsx");
      })
      .catch(function (err) {
        alert("Gagal mengunduh data: " + err.message);
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = original;
      });
  }

  function downloadSheetPdf(sheetName, btn) {
    var original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Menyiapkan…";
    var yearValue = btn.getAttribute("data-year") || "all";
    var found = DOWNLOADABLE_SHEETS.filter(function (d) { return d[1] === sheetName; })[0];
    var label = found ? found[0] : sheetName;

    fetchSheet(sheetName)
      .then(function (rows) {
        var filtered = yearValue === "all" ? rows : rows.filter(function (r) { return String(r.Tahun) === yearValue; });
        if (!filtered.length) filtered = rows; // jaga-jaga kalau ternyata kosong
        var headers = filtered.length ? Object.keys(filtered[0]) : [];
        var body = filtered.map(function (r) { return headers.map(function (h) { return r[h] === undefined || r[h] === null ? "" : String(r[h]); }); });

        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({ orientation: headers.length > 5 ? "landscape" : "portrait" });
        doc.setFontSize(13);
        doc.text(label, 14, 16);
        doc.autoTable({ head: [headers], body: body, startY: 22, styles: { fontSize: 8 }, headStyles: { fillColor: [31, 111, 74] } });
        var suffix = yearValue === "all" ? "" : "-" + yearValue;
        doc.save(slugify(sheetName) + suffix + ".pdf");
      })
      .catch(function (err) {
        alert("Gagal mengunduh data: " + err.message);
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = original;
      });
  }

  function downloadSheetDocx(sheetName, btn) {
    var original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Menyiapkan…";
    var yearValue = btn.getAttribute("data-year") || "all";
    var found = DOWNLOADABLE_SHEETS.filter(function (d) { return d[1] === sheetName; })[0];
    var label = found ? found[0] : sheetName;
    var D = window.docx;

    fetchSheet(sheetName)
      .then(function (rows) {
        var filtered = yearValue === "all" ? rows : rows.filter(function (r) { return String(r.Tahun) === yearValue; });
        if (!filtered.length) filtered = rows; // jaga-jaga kalau ternyata kosong
        var headers = filtered.length ? Object.keys(filtered[0]) : [];

        var headerRow = new D.TableRow({
          tableHeader: true,
          children: headers.map(function (h) {
            return new D.TableCell({
              shading: { fill: "1F6F4A" },
              children: [new D.Paragraph({ children: [new D.TextRun({ text: h, bold: true, color: "FFFFFF" })] })]
            });
          })
        });
        var bodyRows = filtered.map(function (r) {
          return new D.TableRow({
            children: headers.map(function (h) {
              var v = r[h];
              return new D.TableCell({ children: [new D.Paragraph(v === undefined || v === null ? "" : String(v))] });
            })
          });
        });
        var doc = new D.Document({
          sections: [{
            children: [
              new D.Paragraph({ text: label, heading: D.HeadingLevel.HEADING_1 }),
              new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, rows: [headerRow].concat(bodyRows) })
            ]
          }]
        });
        return D.Packer.toBlob(doc);
      })
      .then(function (blob) {
        var suffix = yearValue === "all" ? "" : "-" + yearValue;
        saveBlob(blob, slugify(sheetName) + suffix + ".docx");
      })
      .catch(function (err) {
        alert("Gagal mengunduh data: " + err.message);
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = original;
      });
  }

  /** Simpan Blob sebagai file unduhan (dipakai oleh unduh Word/.docx). */
  function saveBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------------------------------------------------------------------
   * Nav & Footer
   * ------------------------------------------------------------------- */
  function renderNav(cfg) {
    var header = document.getElementById("site-header");
    header.innerHTML =
      '<div class="header-inner"><div class="brand"><div class="brand-emblem">🏛️</div>' +
      '<div class="brand-text"><strong>Kelurahan ' + esc(cfg.nama_kelurahan) + "</strong>" +
      "<span>Kec. " + esc(cfg.kecamatan) + ", Kota " + esc(cfg.kota) + "</span></div></div>" +
      '<nav class="main-nav">' +
      TOP_PAGES.map(function (p) {
        if (!p.children) return '<a href="#/' + p.key + '" data-nav="' + p.key + '">' + p.label + "</a>";
        return (
          '<div class="nav-dropdown">' +
          '<a href="#/' + p.key + '" data-nav="' + p.key + '" class="nav-dropdown-trigger" data-dropdown-toggle>' +
          p.label + ' <span class="nav-caret">▾</span></a>' +
          '<div class="nav-dropdown-menu">' +
          p.children
            .map(function (c) {
              return '<a href="' + esc(c.href) + '"' + (c.download ? " download" : "") + ">" + esc(c.label) + "</a>";
            })
            .join("") +
          "</div></div>"
        );
      }).join("") +
      "</nav></div>";

    header.querySelectorAll("[data-dropdown-toggle]").forEach(function (trigger) {
      trigger.addEventListener("click", function (e) {
        // Di layar sentuh (tanpa hover), tap pertama cuma buka submenu; tap ke-2 baru ikuti link.
        var wrap = trigger.closest(".nav-dropdown");
        if (!wrap.classList.contains("open") && matchMedia("(hover: none)").matches) {
          e.preventDefault();
          document.querySelectorAll(".nav-dropdown.open").forEach(function (o) { o.classList.remove("open"); });
          wrap.classList.add("open");
        }
      });
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".nav-dropdown")) {
        document.querySelectorAll(".nav-dropdown.open").forEach(function (o) { o.classList.remove("open"); });
      }
    });
  }

  function updateNavActive(pageKey) {
    var navKey = (pageKey === "unduh-profil" || pageKey === "unduh-publikasi") ? "unduh" : pageKey;
    document.querySelectorAll("[data-nav]").forEach(function (el) {
      el.classList.toggle("active", el.getAttribute("data-nav") === navKey);
    });
  }

  function renderFooter(cfg) {
    var footer = document.getElementById("site-footer");
    footer.innerHTML =
      '<div class="footer-inner"><div><strong>Kelurahan ' + esc(cfg.nama_kelurahan) + "</strong><br>" +
      "Kecamatan " + esc(cfg.kecamatan) + ", Kota " + esc(cfg.kota) + ", " + esc(cfg.provinsi) + "</div></div>";
  }

  /* ---------------------------------------------------------------------
   * Halaman: Profil (dipakai juga sebagai Beranda / halaman utama situs)
   * ------------------------------------------------------------------- */
  async function buildProfil() {
    var results = await Promise.all([getConfig(), fetchSheet("JarakTempuh"), fetchSheet("Pejabat")]);
    var cfg = results[0], jarak = results[1], pejabat = results[2];

    // Fitur otomatis mengubah link Google Drive menjadi link gambar web
    function getDirectImageUrl(url) {
      if (!url) return "";
      var match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return "https://drive.google.com/uc?export=view&id=" + match[1];
      }
      return url;
    }

    // Mengambil foto Lurah dari sheet Config, jika kosong pakai default "Foto_lurah.png"
    var fotoLurah = getDirectImageUrl(cfg.foto_lurah) || "Foto_lurah.png";

    // Mengumpulkan foto galeri beranda dari sheet Config (maksimal 5 foto)
    var sliderPhotos = [];
    for (var i = 1; i <= 5; i++) {
      var fotoUrl = cfg["foto_beranda_" + i];
      var captionTeks = cfg["caption_beranda_" + i];
      if (fotoUrl && fotoUrl.trim() !== "") {
        sliderPhotos.push({ 
          src: getDirectImageUrl(fotoUrl.trim()), 
          caption: captionTeks || "Foto Kelurahan " + cfg.nama_kelurahan 
        });
      }
    }
    // Jika di sheet Config kosong, gunakan foto bawaan sebagai cadangan
    if (sliderPhotos.length === 0) {
      sliderPhotos = [
        { src: "kantor-kelurahan.jpg", caption: "Kantor Kelurahan " + cfg.nama_kelurahan },
        { src: "dukungan-se.jpg", caption: "Dukungan Pelaksanaan Sensus Ekonomi 2026" }
      ];
    }

    return (
      '<section class="hero"><div class="hero-inner">' +
      "<h1>Selamat Datang di Website Kelurahan " + esc(cfg.nama_kelurahan) + "</h1>" +
      "</div></section>" +
      '<div class="container">' +
      '<section class="card profile-photo-card">' +
      photoSlider("beranda-photos", sliderPhotos) +
      "</section>" +
      '<section class="card"><h2>Sejarah Singkat</h2><p>' + esc(cfg.sejarah) + "</p></section>" +
      '<section class="card"><h2>Visi &amp; Misi</h2><h3>Visi</h3><p>&ldquo;' + esc(cfg.visi) + '&rdquo;</p><h3>Misi</h3><ul>' +
      ["misi_1", "misi_2", "misi_3", "misi_4"].map(function (k) { return "<li>" + esc(cfg[k]) + "</li>"; }).join("") +
      "</ul></section>" +
      '<section class="card"><h2>Lurah Saat Ini</h2><div class="lurah-profile">' +
      '<img class="lurah-photo" src="' + esc(fotoLurah) + '" alt="' + esc(cfg.nama_lurah) + '">' +
      '<div class="lurah-info"><strong>' + esc(cfg.nama_lurah) + "</strong><br>NIP. " + esc(String(cfg.nip_lurah || "").replace(/\s+/g, "")) + "</div>" +
      "</div></section>" +
      '<section class="card"><h2>Riwayat Lurah yang Menjabat</h2>' +
      table(["No", "Nama", "Periode"], pejabat.map(function (r) { return [r.No, esc(r.Nama), esc(r.Periode)]; }), [0]) +
      "</section>" +
      '<section class="card"><h2>Struktur Organisasi &amp; Kepegawaian</h2>' +
		table(
		  ["Nama", "Jenis Kelamin", "Jabatan"],
		  STRUKTUR_ORGANISASI.map(function (r) {
			return [
			  "<strong>" + esc(r.nama) + "</strong>",
			  esc(r.jenis_kelamin),
			  esc(r.jabatan)
			];
		  })
		) +
		"</section>" +
      '<section class="card"><h2>Letak Geografis &amp; Batas Wilayah</h2><div class="two-col">' +
      table(
        ["Batas", "Keterangan"],
        [
          ["Koordinat", esc(cfg.lat) + ", " + esc(cfg.lng)],
          ["Utara", esc(cfg.batas_utara)],
          ["Selatan", esc(cfg.batas_selatan)],
          ["Barat", esc(cfg.batas_barat)],
          ["Timur", esc(cfg.batas_timur)]
        ]
      ) +
      '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3980.08038667702!2d122.62445167591507!3d-4.003896544637589!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2d989360329b3b2b%3A0x20cb812833a7ad5e!2sKantor%20Lurah%20Sambuli%20Kec.%20Nambo!5e0!3m2!1sid!2sid!4v1792461447203!5m2!1sid!2sid" width="400" height="300" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>' +
      "</div>" +
      "<h3>Karakteristik Wilayah</h3><p>" + esc(cfg.karakteristik_wilayah) + "</p>" +
      "</section>" +
      '<section class="card"><h2>Jarak Tempuh ke Kantor Pemerintahan</h2>' +
      table(["Tujuan", "Jarak"], jarak.map(function (r) { return [esc(r.Tujuan), r["Jarak (KM)"] + " km"]; })) +
      "</section>" +
      "</div>"
    );
  }

  /* ---------------------------------------------------------------------
   * Halaman: Data (bingkai + 8 kategori)
   * ------------------------------------------------------------------- */
  async function buildDataPage(kategoriParam, tahunParam) {
    var cfg = await getConfig();
    var kategori = DATA_CATEGORIES[kategoriParam] ? kategoriParam : "pemerintahan";
    var cat = DATA_CATEGORIES[kategori];
    var content = await cat.build(tahunParam);

    var chips = Object.keys(DATA_CATEGORIES)
      .map(function (key) {
        var c = DATA_CATEGORIES[key];
        return '<a href="#/data/' + key + '" class="subnav-item ' + (key === kategori ? "active" : "") + '">' + c.icon + " " + c.label + "</a>";
      })
      .join("");

    return (
      pageHero("Data Kelurahan " + cfg.nama_kelurahan, "Pilih kategori data di bawah ini") +
      '<div class="container"><nav class="subnav">' + chips + "</nav>" + content + "</div>"
    );
  }

  async function buildPemerintahan(tahunParam) {
    var results = await Promise.all([
      fetchSheet("Perangkat"), fetchSheet("PegawaiGender"),
      fetchSheet("RTRW"), fetchSheet("Lembaga")
    ]);
    var perangkatAll = results[0], pegawaiAll = results[1],
      rtrw = results[2], lembaga = results[3];

    var years = unionYears([perangkatAll, pegawaiAll]);
    var fPerangkat = filterByYear(perangkatAll, tahunParam);
    var fPegawai = filterByYear(pegawaiAll, fPerangkat.tahun);

    return (
      '<section class="card">' +
      yearPicker("data/pemerintahan", years, fPerangkat.tahun) +
      "</section>" +
      '<section class="card"><h2>Perangkat &amp; Pegawai Kelurahan — Tahun ' + fPerangkat.tahun + "</h2><div class=\"two-col\">" +
      "<div><h3>Jumlah Perangkat per Jabatan</h3><div class=\"chart-box\">" +
      bars(fPerangkat.rows.map(function (r) { return { k: r.Jabatan, v: r.Jumlah }; }), { horizontal: true }) +
      "</div></div>" +
      "<div><h3>Pegawai menurut Jenis Kelamin</h3><div class=\"chart-box\">" +
      donut(fPegawai.rows.map(function (r) { return { k: r["Jenis Kelamin"], v: r.Jumlah }; }), { colors: [COLORS[0], COLORS[1]] }) +
      legend(fPegawai.rows.map(function (r) { return { k: r["Jenis Kelamin"], v: r.Jumlah }; }), { colors: [COLORS[0], COLORS[1]] }) +
      "</div></div></div></section>" +
      '<section class="card"><h2>Rukun Tetangga (RT) &amp; Rukun Warga (RW)</h2>' +
      table(["Wilayah", "Nama Pengurus"], rtrw.map(function (r) { return [esc(r.Wilayah), esc(r.Nama)]; })) +
      "</section>" +
      '<section class="card"><h2>Lembaga Kemasyarakatan</h2>' +
      table(
        ["Nama Lembaga", "SK", "Pengurus", "Anggota"],
        lembaga.map(function (r) {
          function b(v) { return v === "Ada" ? '<span class="badge badge-good">Ada</span>' : '<span class="badge badge-neutral">Tidak Ada</span>'; }
          return [esc(r["Nama Lembaga"]), b(r.SK), b(r.Pengurus), b(r.Anggota)];
        })
      ) +
      "</section>"
    );
  }

  async function buildKependudukan(tahunParam) {
    var results = await Promise.all([fetchSheet("PendudukGender"), fetchSheet("PendudukPerRT"), fetchSheet("JumlahKeluarga")]);
    var genderAll = results[0], perRTAll = results[1], kk = results[2];

    var years = unionYears([genderAll, perRTAll]);
    var fGender = filterByYear(genderAll, tahunParam);
    var fPerRT = filterByYear(perRTAll, fGender.tahun);
    var total = fGender.rows.reduce(function (s, r) { return s + Number(r.Jumlah || 0); }, 0);

    return (
      '<section class="card">' +
      yearPicker("data/kependudukan", years, fGender.tahun) +
      "</section>" +
      '<section class="stat-grid">' +
      fGender.rows.map(function (r) { return '<div class="stat-card"><div class="stat-value">' + r.Jumlah + '</div><div class="stat-label">' + esc(r["Jenis Kelamin"]) + "</div></div>"; }).join("") +
      '<div class="stat-card"><div class="stat-value">' + total + '</div><div class="stat-label">Total Penduduk</div></div>' +
      (kk.length ? '<div class="stat-card"><div class="stat-value">' + kk[kk.length - 1]["Jumlah Keluarga"] + '</div><div class="stat-label">Keluarga (KK) th. ' + kk[kk.length - 1].Tahun + "</div></div>" : "") +
      "</section>" +
      '<section class="card"><h2>Penduduk menurut Jenis Kelamin — Tahun ' + fGender.tahun + "</h2><div class=\"two-col\">" +
      '<div class="chart-box">' + bars(fGender.rows.map(function (r) { return { k: r["Jenis Kelamin"], v: r.Jumlah }; }), { colors: [COLORS[0], COLORS[1]] }) + "</div>" +
      '<div class="chart-box">' + donut(fGender.rows.map(function (r) { return { k: r["Jenis Kelamin"], v: r.Jumlah }; }), { colors: [COLORS[0], COLORS[1]] }) +
      legend(fGender.rows.map(function (r) { return { k: r["Jenis Kelamin"], v: r.Jumlah }; }), { colors: [COLORS[0], COLORS[1]] }) + "</div></div>" +
      table(["Jenis Kelamin", "Jumlah"], fGender.rows.map(function (r) { return [esc(r["Jenis Kelamin"]), r.Jumlah]; }).concat([["<strong>Total</strong>", "<strong>" + total + "</strong>"]]), [1]) +
      "</section>" +
      '<section class="card"><h2>Penduduk per Wilayah (RT/SLS) — Tahun ' + fPerRT.tahun + "</h2>" +
      '<p class="note">Rincian per RT membantu memetakan kepadatan &amp; kebutuhan layanan per wilayah.</p>' +
      '<div class="chart-box wide">' + bars(fPerRT.rows.map(function (r) { return { k: r.Wilayah, v: r.Jumlah }; }), { horizontal: true }) + "</div>" +
      table(["Wilayah", "Laki-Laki", "Perempuan", "Jumlah"], fPerRT.rows.map(function (r) { return [esc(r.Wilayah), r["Laki-Laki"], r.Perempuan, r.Jumlah]; }), [1, 2, 3]) +
      "</section>" +
      '<section class="card"><h2>Jumlah Keluarga per Tahun</h2>' +
      '<p class="note">Tabel ini menampilkan seluruh tahun yang tercatat — tambahkan baris baru di Sheet setiap tahun sensus berikutnya.</p>' +
      table(["Tahun", "Jumlah Keluarga"], kk.map(function (r) { return [r.Tahun, r["Jumlah Keluarga"]]; })) +
      "</section>"
    );
  }

  async function buildPendidikan(tahunParam) {
    var all = await fetchSheet("Pendidikan");
    var years = unionYears([all]);
    var f = filterByYear(all, tahunParam);
    var counts = {};
    f.rows.forEach(function (r) { counts[r.Jenjang] = (counts[r.Jenjang] || 0) + 1; });
    var chartData = Object.keys(counts).map(function (k) { return { k: k, v: counts[k] }; });

    return (
      '<section class="card"><p>Sarana pendidikan formal dan nonformal: PAUD, SD, PKBM, dan TPQ.</p>' +
      yearPicker("data/pendidikan", years, f.tahun) +
      "</section>" +
      '<section class="card"><h2>Sarana Pendidikan menurut Jenjang — Tahun ' + f.tahun + '</h2><div class="chart-box">' + bars(chartData) + "</div></section>" +
      '<section class="card"><h2>Daftar Sarana Pendidikan</h2>' +
      table(["Jenjang", "Nama", "Status", "Alamat"], f.rows.map(function (r) { return [esc(r.Jenjang), esc(r.Nama), esc(r.Status), esc(r.Alamat)]; })) +
      "</section>"
    );
  }

  async function buildKesehatan(tahunParam) {
    // 1. fetchSheet("TenagaKesehatan") dihapus dari sini
    var results = await Promise.all([
      fetchSheet("FasilitasKesehatan"), fetchSheet("KLB"), fetchSheet("LokasiFasilitasKesehatan")
    ]);
    // 2. Urutan variabel disesuaikan menjadi 3 data
    var faskesAll = results[0], klbAll = results[1], lokasi = results[2];

    // 3. tenagaAll dihapus dari unionYears
    var years = unionYears([faskesAll, klbAll]);
    var fFaskes = filterByYear(faskesAll, tahunParam);
    var fKlb = filterByYear(klbAll, fFaskes.tahun);
    var totalKlb = fKlb.rows.reduce(function (s, r) { return s + Number(r["Kejadian Luar Biasa"] || 0); }, 0);
    var faskesAda = fFaskes.rows.filter(function (r) { return r.Jumlah > 0; });

    return (
      '<section class="card">' +
      yearPicker("data/kesehatan", years, fFaskes.tahun) +
      "</section>" +
      '<section class="card"><h2>Sarana Kesehatan — Tahun ' + fFaskes.tahun + "</h2>" +
      '<p class="note">Daftar resmi jenis sarana kesehatan (BPS Desa Cantik) — sebagian besar bernilai 0 karena belum tersedia.</p><div class="two-col">' +
      table(["Jenis Fasilitas", "Jumlah"], fFaskes.rows.map(function (r) { return [esc(r["Jenis Fasilitas"]), r.Jumlah]; }), [1]) +
      '<div class="chart-box">' + donut(faskesAda.map(function (r) { return { k: r["Jenis Fasilitas"], v: r.Jumlah }; }), { colors: [COLORS[2], COLORS[0], COLORS[3]] }) +
      legend(faskesAda.map(function (r) { return { k: r["Jenis Fasilitas"], v: r.Jumlah }; }), { colors: [COLORS[2], COLORS[0], COLORS[3]] }) + "</div></div>" +
      "<h3>Lokasi Fasilitas yang Tersedia</h3>" +
      table(["Nama Fasilitas", "Lokasi"], lokasi.map(function (r) { return [esc(r["Nama Fasilitas"]), esc(r["Lokasi (RW/RT)"])]; })) +
      "</section>" +
      // 4. Bagian HTML <section class="card"><h2>Tenaga Kesehatan... dihapus seluruhnya dari sini
      '<section class="card"><h2>Kejadian Luar Biasa (KLB) Penyakit — Tahun ' + fKlb.tahun + "</h2>" +
      (totalKlb === 0 ? '<p><span class="badge badge-good">Nihil</span> — Tidak ada kejadian luar biasa penyakit yang tercatat pada tahun ' + fKlb.tahun + ".</p>" : "") +
      table(["No", "Jenis Penyakit", "Jumlah Kejadian"], fKlb.rows.map(function (r) { return [r.No, esc(r["Jenis Penyakit"]), r["Kejadian Luar Biasa"]]; })) +
      "</section>"
    );
  }

  async function buildSosial(tahunParam) {
    var results = await Promise.all([
      fetchSheet("TempatIbadah"), fetchSheet("KondisiBangunan"), fetchSheet("Disabilitas"),
      fetchSheet("Keamanan"), fetchSheet("Keragaman"), fetchSheet("TindakKejahatan")
    ]);
    var ibadah = results[0], bangunanAll = results[1], disabilitasAll = results[2],
      keamananAll = results[3], keragamanAll = results[4], kejahatanAll = results[5];

    var years = unionYears([bangunanAll, disabilitasAll, keamananAll, keragamanAll, kejahatanAll]);
    var fBangunan = filterByYear(bangunanAll, tahunParam);
    var fDisabilitas = filterByYear(disabilitasAll, fBangunan.tahun);
    var fKeamanan = filterByYear(keamananAll, fBangunan.tahun);
    var fKeragaman = filterByYear(keragamanAll, fBangunan.tahun);
    var fKejahatan = filterByYear(kejahatanAll, fBangunan.tahun);
    var totalKejahatan = fKejahatan.rows.reduce(function (s, r) { return s + Number(r["Jumlah SLS/RT Mengalami"] || 0); }, 0);
    var ibadahAda = ibadah.filter(function (r) { return r.Jumlah > 0; });

    return (
      '<section class="card">' +
      yearPicker("data/sosial", years, fBangunan.tahun) +
      "</section>" +
      '<section class="card"><h2>Tempat Ibadah</h2><div class="two-col">' +
      table(["Jenis", "Jumlah"], ibadah.map(function (r) { return [esc(r["Jenis Tempat Ibadah"]), r.Jumlah]; }), [1]) +
      '<div class="chart-box">' + donut(ibadahAda.map(function (r) { return { k: r["Jenis Tempat Ibadah"], v: r.Jumlah }; }), { colors: [COLORS[2], COLORS[3]] }) +
      legend(ibadahAda.map(function (r) { return { k: r["Jenis Tempat Ibadah"], v: r.Jumlah }; }), { colors: [COLORS[2], COLORS[3]] }) + "</div></div></section>" +
      '<section class="card"><h2>Keragaman Sosial — Tahun ' + fKeragaman.tahun + "</h2>" +
      '<p class="note">Jumlah RT yang majemuk (multi) dari total RT di kelurahan.</p>' +
      table(["Aspek", "RT Majemuk", "Total RT"], fKeragaman.rows.map(function (r) { return [esc(r.Aspek), r["Jumlah SLS/RT Majemuk"], r["Total SLS/RT"]]; })) +
      "</section>" +
      '<section class="card"><h2>Kondisi Bangunan Rumah Tinggal — Tahun ' + fBangunan.tahun + '</h2><div class="two-col">' +
      '<div class="chart-box">' + donut(fBangunan.rows.map(function (r) { return { k: r["Karakteristik Bangunan"], v: r.Jumlah }; }), { colors: [COLORS[2], "#b3423a"] }) +
      legend(fBangunan.rows.map(function (r) { return { k: r["Karakteristik Bangunan"], v: r.Jumlah }; }), { colors: [COLORS[2], "#b3423a"] }) + "</div>" +
      table(["Karakteristik", "Jumlah"], fBangunan.rows.map(function (r) { return [esc(r["Karakteristik Bangunan"]), r.Jumlah]; }), [1]) +
      "</div></section>" +
      '<section class="card"><h2>Data Disabilitas — Tahun ' + fDisabilitas.tahun + "</h2>" +
      table(["Jenis Disabilitas", "Jumlah"], fDisabilitas.rows.map(function (r) { return [esc(r["Jenis Disabilitas"]), r.Jumlah]; }), [1]) +
      "</section>" +
      '<section class="card"><h2>Upaya Menjaga Keamanan Lingkungan — Tahun ' + fKeamanan.tahun + "</h2>" +
      table(
        ["Upaya", "Keterangan"],
        fKeamanan.rows.map(function (r) {
          return [esc(r["Upaya Menjaga Keamanan Lingkungan"]), r.Uraian === "Ada" ? '<span class="badge badge-good">Ada</span>' : '<span class="badge badge-neutral">Tidak Ada</span>'];
        })
      ) +
      "</section>" +
      '<section class="card"><h2>Tindak Kejahatan Setahun Terakhir — Tahun ' + fKejahatan.tahun + "</h2>" +
      (totalKejahatan === 0
        ? '<p><span class="badge badge-good">Nihil</span> — Tidak ada RT yang mengalami tindak kejahatan pada tahun ini.</p>'
        : '<p><span class="badge badge-bad">' + totalKejahatan + ' RT mengalami kejadian</span> dari 12 jenis tindak kejahatan yang dipantau.</p>') +
      table(["Jenis Tindak Kejahatan", "RT yang Mengalami"], fKejahatan.rows.map(function (r) { return [esc(r["Jenis Tindak Kejahatan"]), r["Jumlah SLS/RT Mengalami"]]; })) +
      "</section>"
    );
  }

  async function buildEkonomi(tahunParam) {
    var results = await Promise.all([fetchSheet("UMKM"), fetchSheet("SaranaPenunjangEkonomi"), fetchSheet("IndustriKecilMikro")]);
    var umkmAll = results[0], penunjangAll = results[1], industriAll = results[2];

    var years = unionYears([umkmAll, penunjangAll, industriAll]);
    var fUmkm = filterByYear(umkmAll, tahunParam);
    var fPenunjang = filterByYear(penunjangAll, fUmkm.tahun);
    var fIndustri = filterByYear(industriAll, fUmkm.tahun);
    var industriAda = fIndustri.rows.filter(function (r) { return r.Jumlah > 0; });
    var penunjangAda = fPenunjang.rows.filter(function (r) { return r.Jumlah > 0; });

    return (
      '<section class="card">' +
      yearPicker("data/ekonomi", years, fUmkm.tahun) +
      "</section>" +
      '<section class="card"><h2>Jenis Usaha Perdagangan / Industri / Ritel — Tahun ' + fUmkm.tahun + '</h2><div class="two-col">' +
      table(["Jenis Usaha", "Jumlah"], fUmkm.rows.map(function (r) { return [esc(r["Jenis Usaha"]), r.Jumlah]; }), [1]) +
      '<div class="chart-box">' + bars(fUmkm.rows.map(function (r) { return { k: r["Jenis Usaha"], v: r.Jumlah }; }), { horizontal: true }) + "</div></div></section>" +
      '<section class="card"><h2>Sarana Penunjang Ekonomi — Tahun ' + fPenunjang.tahun + '</h2><div class="two-col">' +
      table(["Jenis Sarana", "Jumlah"], fPenunjang.rows.map(function (r) { return [esc(r["Jenis Sarana"]), r.Jumlah]; }), [1]) +
      '<div class="chart-box">' + donut(penunjangAda.map(function (r) { return { k: r["Jenis Sarana"], v: r.Jumlah }; }), { colors: [COLORS[0], COLORS[2], COLORS[3], COLORS[4]] }) +
      legend(penunjangAda.map(function (r) { return { k: r["Jenis Sarana"], v: r.Jumlah }; }), { colors: [COLORS[0], COLORS[2], COLORS[3], COLORS[4]] }) + "</div></div></section>" +
      '<section class="card"><h2>Industri Kecil &amp; Mikro — Tahun ' + fIndustri.tahun + "</h2>" +
      '<p class="note">Menampilkan jenis yang ada saja (dari ' + fIndustri.rows.length + ' jenis yang didata BPS).</p><div class="two-col">' +
      table(["Jenis Industri", "Jumlah"], industriAda.map(function (r) { return [esc(r["Jenis Industri"]), r.Jumlah]; }), [1]) +
      '<div class="chart-box">' + bars(industriAda.map(function (r) { return { k: r["Jenis Industri"], v: r.Jumlah }; }), { horizontal: true }) + "</div></div></section>"
    );
  }

  async function buildInfrastruktur(tahunParam) {
    var results = await Promise.all([fetchSheet("Transportasi"), fetchSheet("Komunikasi"), fetchSheet("Perumahan")]);
    var transAll = results[0], komAll = results[1], perumahan = results[2];

    var years = unionYears([transAll, komAll]);
    var fTrans = filterByYear(transAll, tahunParam);
    var fKom = filterByYear(komAll, fTrans.tahun);

    function groupBy(rows, key) {
      var groups = {},
        order = [];
      rows.forEach(function (r) {
        var k = r[key];
        if (!groups[k]) { groups[k] = []; order.push(k); }
        groups[k].push(r);
      });
      return order.map(function (k) { return { indikator: k, rows: groups[k] }; });
    }
    var transGroups = groupBy(fTrans.rows, "Indikator");
    var komGroups = groupBy(fKom.rows, "Indikator");

    return (
      '<section class="card">' +
      yearPicker("data/infrastruktur", years, fTrans.tahun) +
      "</section>" +
      '<section class="card"><h2>Transportasi &amp; Angkutan — Tahun ' + fTrans.tahun + "</h2>" +
      transGroups.map(function (g) {
        return "<h3>" + esc(g.indikator) + "</h3>" + table(["Kategori", "Jumlah RT"], g.rows.map(function (r) { return [esc(r.Kategori), r["Jumlah SLS/RT"]]; }));
      }).join("") +
      "</section>" +
      '<section class="card"><h2>Komunikasi &amp; Informasi — Tahun ' + fKom.tahun + "</h2>" +
      komGroups.map(function (g) {
        return "<h3>" + esc(g.indikator) + "</h3>" + table(["Kategori", "Jumlah"], g.rows.map(function (r) { return [esc(r.Kategori), r.Jumlah]; }));
      }).join("") +
      "</section>" +
      '<section class="card"><h2>Listrik &amp; Penerangan Jalan per RW</h2>' +
      '<p class="note">Tabel ini tidak terikat tahun tertentu — mencerminkan kondisi kelistrikan saat ini.</p>' +
      table(
        ["RW", "Pengguna PLN", "Non-PLN", "Bukan Pengguna", "Penerangan: Pemerintah", "Non-Pemerintah", "Non-Listrik", "Tidak Ada"],
        perumahan.map(function (r) {
          return [
            esc(r.RW), r["Pengguna Listrik PLN"], r["Pengguna Listrik Non-PLN"], r["Bukan Pengguna Listrik"],
            r["Penerangan Jalan: Listrik Pemerintah"], r["Penerangan Jalan: Listrik Non-Pemerintah"],
            r["Penerangan Jalan: Non-Listrik"], r["Penerangan Jalan: Tidak Ada"]
          ];
        })
      ) +
      "</section>"
    );
  }

  async function buildKeuangan(tahunParam) {
    var keuAll = await fetchSheet("Keuangan");
    var years = unionYears([keuAll]);
    var f = filterByYear(keuAll, tahunParam);
    var keu = f.rows[0] || {};

    return (
      '<section class="card"><h2>Realisasi Belanja Kelurahan</h2>' +
      yearPicker("data/keuangan", years, f.tahun, "Tahun anggaran") +
      "</section>" +
      '<section class="stat-grid">' +
      '<div class="stat-card"><div class="stat-value" style="font-size:18px;">' + rupiah(keu["Pagu Anggaran"]) + '</div><div class="stat-label">Pagu Anggaran (DPPA) ' + keu.Tahun + "</div></div>" +
      '<div class="stat-card"><div class="stat-value" style="font-size:18px;">' + rupiah(keu["Realisasi Belanja"]) + '</div><div class="stat-label">Realisasi Belanja (LRA)</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + keu.Persentase + '%</div><div class="stat-label">Persentase Realisasi</div></div>' +
      "</section>" +
      '<section class="card"><h2>Rincian Pagu &amp; Realisasi Belanja Tahun ' + keu.Tahun + '</h2><div class="two-col">' +
      table(
        ["Uraian", "Jumlah"],
        [
          ["Pagu Anggaran", rupiah(keu["Pagu Anggaran"])],
          ["Belanja Operasi", rupiah(keu["Belanja Operasi"])],
          ["Belanja Modal", rupiah(keu["Belanja Modal"])],
          ["Realisasi Belanja", rupiah(keu["Realisasi Belanja"])],
          ["Persentase", keu.Persentase + "%"]
        ]
      ) +
      '<div class="chart-box">' +
      bars(
        [
          { k: "Pagu", v: Math.round(Number(keu["Pagu Anggaran"]) / 1e6) },
          { k: "Operasi", v: Math.round(Number(keu["Belanja Operasi"]) / 1e6) },
          { k: "Modal", v: Math.round(Number(keu["Belanja Modal"]) / 1e6) },
          { k: "Realisasi", v: Math.round(Number(keu["Realisasi Belanja"]) / 1e6) }
        ],
        { colors: [COLORS[0], COLORS[2], COLORS[3], "#1f6f4a"] }
      ) +
      '<div class="note" style="text-align:center;">dalam juta rupiah</div></div>' +
      "</div></section>"
    );
  }

  /* ---------------------------------------------------------------------
   * Halaman: Infografis
   * ------------------------------------------------------------------- */
  async function buildInfografis(tahunParam) {
    // Mengambil data langsung dari tab "Infografis" di Google Sheet
    var results = await Promise.all([getConfig(), fetchSheet("Infografis")]);
    var cfg = results[0];
    var infografisAll = results[1] || [];
    
    var years = unionYears([infografisAll]);
    var activeYear = tahunParam && years.indexOf(Number(tahunParam)) > -1 ? Number(tahunParam) : (years[0] || new Date().getFullYear());
    var fInfo = filterByYear(infografisAll, activeYear);

    return (
      pageHero("Infografis Kelurahan " + cfg.nama_kelurahan, "") +
      '<div class="container">' +
      '<section class="card">' +
      (years.length > 0 ? yearPicker("infografis", years, activeYear) : "") +
      "</section>" +
      '<section class="card"><h2>Infografis Tahun ' + activeYear + '</h2><div class="infografis-gallery">' +
      (fInfo.rows && fInfo.rows.length > 0
        ? fInfo.rows.map(function (r) {
            var foto = r.Foto || r.Gambar || "";
            var judul = r.Judul || "Infografis";
            if (!foto) return ""; // Lewati jika nama file fotonya kosong
            return (
              '<div class="infografis-item"><img src="' + esc(foto) + '" alt="' + esc(judul) + '" data-lightbox="' + esc(foto) + '">' +
              '<p class="infografis-caption">' + esc(judul) + "</p>" +
              '<a class="btn" href="' + esc(foto) + '" download="' + esc(foto) + '">⬇️ Unduh</a></div>'
            );
          }).join("")
        : '<p class="note">Belum ada infografis untuk tahun ini. Tambahkan baris baru di sheet <strong>Infografis</strong>.</p>') +
      "</div></section>" +
      "</div>"
    );
  }

  /* ---------------------------------------------------------------------
   * Halaman: Berita
   * ------------------------------------------------------------------- */
  function formatTanggalIndo(value) {
    var bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.getDate() + " " + bulan[d.getMonth()] + " " + d.getFullYear();
  }

  async function buildBerita() {
    var results = await Promise.all([getConfig(), fetchSheet("Berita")]);
    var cfg = results[0];
    // Mengurutkan SEMUA berita dari yang terbaru ke terlama secara otomatis
    var berita = results[1].slice().sort(function (a, b) { return new Date(b.Tanggal) - new Date(a.Tanggal); });

    return (
      pageHero("Berita & Pengumuman", "Kabar terbaru dari Kelurahan " + cfg.nama_kelurahan) +
      '<div class="container"><section class="card">' +
      (berita.length === 0
        ? '<p class="note">Belum ada berita. Tambahkan baris baru di sheet <strong>Berita</strong> untuk menampilkannya di sini.</p>'
        : berita
            .map(function (r, i) {
              // Membaca teks/link dari Kolom E (yang diberi judul "Foto" atau "Gambar" di Sheet)
              var namaFoto = r.Foto || r.Gambar || ""; 
              var hasPhoto = namaFoto.trim() !== "";
              var fotoUrl = hasPhoto ? esc(namaFoto.trim()) : "";

              var body =
                '<div class="berita-date">' + esc(formatTanggalIndo(r.Tanggal)) + "</div>" +
                '<h3 class="berita-title">' + esc(r.Judul) + "</h3>" +
                '<p class="berita-summary">' + esc(r.Ringkasan) + "</p>" +
                '<div class="berita-body" id="berita-body-' + i + '">' + esc(r.Isi) + "</div>" +
                '<button class="berita-toggle" data-toggle="berita-body-' + i + '">Baca Selengkapnya ▾</button>';
                
              return hasPhoto
                ? '<div class="berita-card has-photo"><img class="berita-photo" src="' + fotoUrl + '" alt="' + esc(r.Judul) + '" data-lightbox="' + fotoUrl + '"><div class="berita-content">' + body + "</div></div>"
                : '<div class="berita-card">' + body + "</div>";
            })
            .join("")) +
      "</section></div>"
    );
  }

  /* ---------------------------------------------------------------------
   * Halaman: Unduh Data
   * ------------------------------------------------------------------- */
  async function buildUnduh(tahunParam) {
    var allRows = await Promise.all(DOWNLOADABLE_SHEETS.map(function (d) { return fetchSheet(d[1]); }));
    var years = unionYears(allRows);
    var activeYear = tahunParam && years.indexOf(Number(tahunParam)) > -1 ? Number(tahunParam) : years[0];

    return (
      pageHero("Unduh Data", "Semua data pada situs ini dapat diunduh dalam format Excel (.xlsx)") +
      '<div class="container">' +
      '<section class="card">' +
      yearPicker("unduh", years, activeYear) +
      "</section>" +
      '<section class="card">' +
      DOWNLOADABLE_SHEETS.map(function (d, i) {
        var sheetName = d[1];
        var sheetYears = unionYears([allRows[i]]);
        var hasYear = sheetYears.length > 0;
        /* Kalau tahun yang dipilih di atas tidak ada untuk dataset ini (mis. Keuangan cuma
           punya tahun 2025 sementara pilihan global 2026), pakai tahun terbaru milik dataset
           itu sendiri — supaya tidak mengunduh data kosong/salah tahun. */
        var resolvedYear = hasYear ? (sheetYears.indexOf(activeYear) > -1 ? activeYear : sheetYears[0]) : null;
        var btnYearAttr = hasYear ? ' data-year="' + resolvedYear + '"' : "";
        return (
          '<div class="download-row"><div class="label">' + esc(d[0]) + "</div>" +
          '<div class="download-actions">' +
          '<button class="btn" data-download="' + esc(sheetName) + '"' + btnYearAttr + ">⬇️ Unduh Excel</button>" +
          '<button class="btn btn-outline" data-download-pdf="' + esc(sheetName) + '"' + btnYearAttr + ">⬇️ Unduh PDF</button>" +
          '<button class="btn btn-outline" data-download-docx="' + esc(sheetName) + '"' + btnYearAttr + ">⬇️ Unduh Word</button>" +
          "</div></div>"
        );
      }).join("") +
      "</section></div>"
    );
  }

  /* ---------------------------------------------------------------------
   * Halaman: Unduh Profil (dokumen profil kelurahan, bukan data per-sheet)
   * ------------------------------------------------------------------- */
  async function buildUnduhProfil(tahunParam) {
    var results = await Promise.all([getConfig(), fetchSheet("PendudukGender")]);
    var cfg = results[0];
    var years = unionYears([results[1]]);
    var activeYear = tahunParam && years.indexOf(Number(tahunParam)) > -1 ? Number(tahunParam) : years[0];
    var label = "Profil Kelurahan " + cfg.nama_kelurahan + " Tahun " + activeYear;

    return (
      pageHero("Unduh Profil", "Dokumen profil resmi Kelurahan " + cfg.nama_kelurahan) +
      '<div class="container">' +
      '<section class="card">' +
      yearPicker("unduh-profil", years, activeYear) +
      "</section>" +
      '<section class="card">' +
      '<div class="download-row"><div class="label">' + esc(label) + "</div>" +
      '<div class="download-actions">' +
      '<a class="btn" href="profil-word.docx" download="' + esc(label) + '.docx">⬇️ Unduh Word</a>' +
      '<a class="btn btn-outline" href="profil-kelurahan.pdf" download="' + esc(label) + '.pdf">⬇️ Unduh PDF</a>' +
      "</div></div>" +
      "</section></div>"
    );
  }

  /* ---------------------------------------------------------------------
   * Halaman: Unduh Publikasi (dokumen publikasi statistik kelurahan)
   * ------------------------------------------------------------------- */
  async function buildUnduhPublikasi(tahunParam) {
    var results = await Promise.all([getConfig(), fetchSheet("PendudukGender")]);
    var cfg = results[0];
    var years = unionYears([results[1]]);
    var activeYear = tahunParam && years.indexOf(Number(tahunParam)) > -1 ? Number(tahunParam) : years[0];
    var label = "Publikasi Kelurahan " + cfg.nama_kelurahan + " Tahun " + activeYear;

    return (
      pageHero("Unduh Publikasi", "Dokumen publikasi statistik Kelurahan " + cfg.nama_kelurahan) +
      '<div class="container">' +
      '<section class="card">' +
      yearPicker("unduh-publikasi", years, activeYear) +
      "</section>" +
      '<section class="card">' +
      '<div class="download-row"><div class="label">' + esc(label) + "</div>" +
      '<div class="download-actions">' +
      '<a class="btn" href="publikasi-word.docx" download="' + esc(label) + '.docx">⬇️ Unduh Word</a>' +
      '<a class="btn btn-outline" href="publikasi.pdf" download="' + esc(label) + '.pdf">⬇️ Unduh PDF</a>' +
      "</div></div>" +
      "</section></div>"
    );
  }

  /* ---------------------------------------------------------------------
   * Halaman: Ajukan Permintaan Data
   * ------------------------------------------------------------------- */
  async function buildPermintaan() {
    var cfg = await getConfig();
    return (
      pageHero("Ajukan Permintaan Data", "Formulir permintaan data resmi Kelurahan " + esc(cfg.nama_kelurahan)) +
      '<div class="container">' +
      '<section class="card">' +
      '<p class="note">Isi formulir di bawah ini, lalu tekan &ldquo;Kirim via WhatsApp&rdquo; — WhatsApp Anda akan ' +
      "terbuka dengan pesan yang sudah terisi otomatis, ditujukan ke pihak Kelurahan " + esc(cfg.nama_kelurahan) +
      ". Tinggal ditekan Kirim dari WhatsApp Anda.</p>" +
      '<form id="permintaan-form" class="form-grid">' +
      '<label>Nama yang Mengajukan Permintaan Data<input required name="nama" type="text" placeholder="Nama lengkap"></label>' +
      '<label>Alamat<input required name="alamat" type="text" placeholder="Alamat lengkap (RT/RW, dsb.)"></label>' +
      '<label>No. HP / WhatsApp<input required name="hp" type="tel" placeholder="08xxxxxxxxxx"></label>' +
      '<label>Data yang Diminta<textarea required name="data" rows="3" placeholder="Sebutkan data yang ingin diminta"></textarea></label>' +
      '<label>Tujuan Permintaan Data<textarea required name="tujuan" rows="3" placeholder="Untuk keperluan apa data ini diminta"></textarea></label>' +
      '<button type="submit" class="btn">📤 Kirim via WhatsApp</button>' +
      "</form>" +
      "</section>" +
      "</div>"
    );
  }

  function handlePermintaanSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var fd = new FormData(form);
    var nama = String(fd.get("nama") || "").trim();
    var alamat = String(fd.get("alamat") || "").trim();
    var hp = String(fd.get("hp") || "").trim();
    var data = String(fd.get("data") || "").trim();
    var tujuan = String(fd.get("tujuan") || "").trim();
    if (!nama || !alamat || !hp || !data || !tujuan) {
      alert("Mohon lengkapi semua isian formulir terlebih dahulu.");
      return;
    }
    var pesan =
      "*Permintaan Data - Kelurahan Tondonggeu*\n\n" +
      "Nama Pemohon: " + nama + "\n" +
      "Alamat: " + alamat + "\n" +
      "No. HP: " + hp + "\n" +
      "Data yang Diminta: " + data + "\n" +
      "Tujuan Permintaan: " + tujuan;
    var url = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(pesan);
    window.open(url, "_blank");
  }

  /* ---------------------------------------------------------------------
   * Bootstrap
   * ------------------------------------------------------------------- */
  async function boot() {
    try {
      var cfg = await getConfig();
      renderNav(cfg);
      renderFooter(cfg);
    } catch (err) {
      document.getElementById("app").innerHTML =
        '<div class="container"><div class="error-box"><strong>Gagal memuat database.</strong><br>' +
        esc(err.message) +
        '<br><br>Pastikan: (1) SPREADSHEET_ID di app.js sudah benar, (2) Google Sheet-nya sudah di-share sebagai "Anyone with the link – Viewer".</div></div>';
      return;
    }
    await render();
    window.addEventListener("hashchange", render);
    prefetchRemainingSheets();
  }

  /**
   * Diam-diam ambil semua sheet lain di belakang layar setelah halaman pertama tampil
   * (tidak memblokir apa pun). Efeknya: begitu pengguna klik kategori/menu apa pun untuk
   * PERTAMA kalinya, datanya kemungkinan besar sudah siap di cache -> tampil instan,
   * bukan cuma pada kunjungan berikutnya ke kategori yang sama.
   *
   * Dibatasi 4 permintaan berbarengan (bukan sekaligus semua ~28) — kalau dibuka semua
   * sekaligus, ditambah permintaan halaman yang baru diklik pengguna, jumlah koneksi
   * bersamaan ke Google bisa kelebihan dan malah ada yang gagal dimuat.
   */
  function prefetchRemainingSheets() {
    var queue = DOWNLOADABLE_SHEETS.map(function (d) { return d[1]; }).concat(["LokasiFasilitasKesehatan", "Berita"]);
    var CONCURRENCY = 4;
    var index = 0;
    function next() {
      if (index >= queue.length) return;
      var name = queue[index++];
      fetchSheet(name)
        .catch(function () {
          delete objCache[name];
          delete rawCache[name];
        })
        .then(next);
    }
    for (var i = 0; i < CONCURRENCY; i++) next();
  }

  boot();
})();
