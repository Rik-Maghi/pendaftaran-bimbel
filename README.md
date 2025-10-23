# Bimbel Registration MVP (Static Website)

Ini website statis (tanpa server). Cara run:
1. Download zip: **bimbel_site.zip**
2. Ekstrak, lalu buka `index.html` (double click) di browser modern (Chrome/Edge).
3. Data disimpan di **localStorage** (hanya di komputer kamu).

## Fitur
- Pendaftaran siswa → generate **No. Invoice** (`INV-2025-####`).
- Upload bukti pembayaran (gambar disimpan base64 di localStorage).
- Cek status (Pending/Verified/Rejected).
- Admin dashboard (password demo: **admin**):
  - Verifikasi/Reject pembayaran.
  - Lihat kuota terpakai per kelas.
  - Export CSV (registrations & payments).
- Cetak Invoice (halaman `invoice.html?invoice=INV-...`).

## Catatan
- Ini untuk demo lokal. Untuk produksi, pindahkan penyimpanan ke DB (mis. Supabase/Firebase) & auth beneran.
- Data awal (program/kelas) sudah disediakan, bisa diubah di `app.js`.
