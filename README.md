# Website Kelurahan Tondonggeu (versi statis — HTML/CSS/JS, tanpa server)

Versi ini **bukan** Google Apps Script lagi. Ini situs statis biasa (`index.html`, `style.css`,
`app.js`, + 2 foto) yang mengambil data langsung dari Google Sheets Anda yang sudah ada, lewat
browser (client-side) — tanpa server, tanpa backend, gratis di-hosting di Vercel.

**Kenapa lebih cepat dari versi Apps Script:** Apps Script membungkus setiap halaman dalam iframe
sandbox berlapis milik Google dan me-reload penuh setiap ganti menu. Versi ini murni file statis:
begitu data sebuah kategori sudah dimuat sekali, pindah menu berikutnya **instan** (tidak reload,
tidak ada permintaan jaringan baru) karena datanya sudah tersimpan di memori browser.

**Optimasi tambahan yang sudah diterapkan:**
- Tiap kategori mengambil semua sheet yang dibutuhkannya **secara bersamaan** (paralel), bukan
  satu-satu berurutan — ini optimasi paling berpengaruh, bisa memangkas waktu muat beberapa kali lipat.
- Setelah Beranda tampil, situs diam-diam mengambil semua sheet lain di latar belakang (dibatasi
  4 permintaan bersamaan supaya tidak membebani), jadi kategori lain kemungkinan besar sudah siap
  di memori begitu Anda klik menu pertama kalinya — bukan cuma pada kunjungan kedua dst.

## Struktur file

| File | Isi |
|---|---|
| `index.html` | Kerangka halaman (cuma judul + tempat kosong, isi diisi oleh app.js) |
| `style.css` | Semua tampilan (identik dengan versi Apps Script) |
| `app.js` | Semua logika: ambil data dari Google Sheets, routing, render tiap halaman, grafik |
| `kantor-kelurahan.jpg` | Foto Kantor Kelurahan, tampil di halaman Profil |
| `lurah-sekarang.jpg` | Foto Lurah saat ini, tampil di halaman Profil |

Tidak ada file lain yang dibutuhkan — tidak ada `package.json`, tidak ada proses build.

## Bagaimana data diambil

`app.js` memakai `SPREADSHEET_ID` yang sudah diarahkan ke spreadsheet **"Database Website Kelurahan
Tondonggeu"** yang sama persis dengan yang dipakai versi Apps Script (datanya tidak perlu dipindah).
Setiap sheet diambil lewat endpoint ekspor CSV bawaan Google:

```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/gviz/tq?tqx=out:csv&headers=1&sheet=NamaSheet
```

Ini **mengharuskan** spreadsheet-nya di-share sebagai **"Anyone with the link – Viewer"** (siapa
saja yang punya link bisa lihat, tidak bisa edit) — kalau belum, buka spreadsheet → tombol **Share**
→ ubah ke itu. *(Sudah dicek: spreadsheet Anda saat ini sudah dalam kondisi ini, jadi tidak perlu
diubah lagi.)*

## Cara deploy ke Vercel (gratis)

**Cara tercepat — tanpa akun GitHub:**
1. Buka [vercel.com](https://vercel.com) → daftar/masuk (bisa pakai akun Google).
2. Di dashboard, klik **Add New → Project**.
3. Pilih tab **"Deploy without Git"** / seret folder `website-kelurahan-tondonggeu-vercel` ini
   langsung ke area upload.
4. Vercel otomatis mendeteksi ini situs statis — klik **Deploy**. Selesai dalam ~30 detik.
5. Anda dapat URL publik gratis seperti `https://nama-proyek-anda.vercel.app`.

**Cara yang lebih rapi untuk jangka panjang — lewat GitHub (disarankan kalau nanti mau update terus):**
1. Buat repo baru di [github.com](https://github.com), upload semua file di folder ini ke situ.
2. Di Vercel, **Add New → Project → Import Git Repository**, pilih repo tadi.
3. Biarkan pengaturan default (situs statis, tidak perlu framework preset apa pun) → **Deploy**.
4. Setiap kali Anda push perubahan ke GitHub, Vercel otomatis deploy ulang.

Tidak perlu `vercel.json` — situs ini murni statis dan pakai navigasi berbasis `#` (hash), jadi
tidak perlu pengaturan rewrite/redirect apa pun.

## Cara update data

Sama seperti sebelumnya: buka spreadsheet **"Database Website Kelurahan Tondonggeu"** di Google
Drive, edit langsung di sana. Perubahan otomatis muncul di website — pengunjung baru akan langsung
melihatnya begitu buka/refresh situs (tidak perlu deploy ulang sama sekali, karena app.js selalu
mengambil data terbaru saat halaman dimuat).

## Cara update tampilan/kode

Edit `index.html`, `style.css`, atau `app.js` di komputer Anda, lalu:
- **Deploy tanpa Git**: ulangi langkah "seret folder ke Vercel" di atas (bikin deployment baru,
  URL tetap sama kalau pakai project Vercel yang sama).
- **Deploy lewat Git**: `git add . && git commit -m "update" && git push` — Vercel otomatis deploy.

## Catatan teknis

- **Grafik** digambar langsung pakai SVG (tanpa Chart.js atau library luar apa pun) — lebih ringan
  dan lebih cepat dimuat.
- **Navigasi** pakai hash (`#/data/pemerintahan`) supaya bisa jalan di hosting statis murni tanpa
  konfigurasi server apa pun, dan supaya tombol Back/Forward browser tetap berfungsi normal.
- **Unduh Data** menghasilkan file Excel (.xlsx), PDF, ATAU Word (.docx) asli, dibuat di browser
  pengunjung memakai library [SheetJS](https://sheetjs.com/) (Excel), [jsPDF](https://github.com/parallax/jsPDF)
  + jspdf-autotable (PDF), dan [docx](https://docx.js.org/) (Word), semuanya dimuat dari CDN jsDelivr
  di `index.html`. Ini satu-satunya dependensi luar di proyek ini — kalau suatu saat jaringan tempat
  situs diakses memblokir jsDelivr, tombol unduh tidak akan berfungsi (halaman lain tetap normal).
- Sudah diuji langsung dengan data live: 6 halaman utama, 8 kategori data, dropdown tahun, dan tombol
  unduh Excel, PDF & Word semuanya berfungsi (bukan ilustratif) — tinggal klik, langsung terunduh.

## ⚠️ Ada 1 data kecil yang perlu diperbaiki manual di Sheet

Google (lewat endpoint yang dipakai situs ini) diam-diam **mengosongkan sel yang isinya campuran
teks+angka dalam satu kolom**. Ditemukan 1 kasus: sheet **SaranaPrasarana**, baris **"Kursi Tamu"**,
kolom **Jumlah** — isinya `"1 set"` (ada teksnya), jadi tampil kosong di situs.

**Perbaikan:** buka sheet `SaranaPrasarana`, ganti nilai kolom Jumlah baris "Kursi Tamu" dari
`1 set` jadi `1` saja (angka polos). Setelah itu langsung benar tanpa perlu deploy ulang apa pun.

Kalau ke depan ada kolom lain yang campur teks+angka dan tiba-tiba tampil kosong di situs, ini
penyebabnya — solusinya sama: pastikan satu kolom isinya konsisten (semua angka, atau semua teks).
