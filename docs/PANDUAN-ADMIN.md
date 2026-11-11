# Panduan Administrator

## Urutan persiapan
1. **Pengaturan Ujian** — isi nama try out, informasi singkat, zona waktu, tanggal/jam mulai & berakhir,
   durasi (default 100 menit), dan passing grade. **Verifikasi passing grade terhadap regulasi yang berlaku**;
   nilai awal (TWK 65, TIU 80, TKP 166) hanya contoh.
2. **Bank Soal** — masukkan 110 soal: nomor 1–30 TWK, 31–65 TIU, 66–110 TKP. Subtes ditentukan otomatis dari
   nomor. TWK/TIU: pilih kunci jawaban. TKP: isi bobot 1–5 untuk setiap pilihan. Gunakan *Simpan & tambah
   berikutnya* agar cepat. Preview menunjukkan tampilan peserta.
   - Gambar: masukkan URL HTTPS publik yang mengarah langsung ke file gambar. Kompres dulu (WebP, ideal
     ≤ 200 KB, teks/angka tetap terbaca). Aplikasi **tidak** mengompresi gambar. Hindari layanan yang
     membatasi hotlink. Pastikan gambar tetap tersedia selama kegiatan.
3. **Peserta** — *Tambah peserta* (satu per satu) atau *Tambah banyak* (tempel baris
   `Nama;username;password`). Password hanya terlihat saat dibuat — catat dan bagikan langsung. Lupa password →
   ikon kunci (reset). Nonaktifkan akun → peserta tidak bisa login.
4. **Token** — buat token (acak 6 karakter atau kustom). Token hanya tampil sekali; bila lupa, buat ulang.
5. **Pengaturan Ujian → Buka ujian** — tombol aktif bila semua validasi terpenuhi (110 soal lengkap, kunci &
   bobot valid, jadwal benar, token aktif). Setelah dibuka, soal & pengaturan **terkunci**. Selama belum ada
   peserta yang memulai, ujian bisa dikembalikan ke draft.

## Saat ujian berlangsung
- **Dashboard** — ringkasan + tabel pemantauan (otomatis diperbarui tiap 30 detik). Filter: sedang
  mengerjakan, belum memulai, selesai, waktu habis, tidak mengikuti.
- Bagikan token kepada peserta. Mengganti token tidak memengaruhi peserta yang sudah memasukkan token.
- **Peserta pindah perangkat** (HP mati/rusak): perangkat lama otomatis dilepas setelah ~90 detik tidak
  aktif. Untuk mempercepat, klik **Lepas perangkat** di dashboard, lalu peserta login di perangkat baru.
  Timer tidak berhenti.
- **Tutup ujian** (Pengaturan Ujian) — ketik `TUTUP`. Semua sesi berjalan langsung dinilai dari jawaban yang
  sudah tersimpan. Tidak dapat dibatalkan. Tanpa ditutup manual pun, peserta tidak bisa memulai setelah jam
  berakhir dan setiap sesi berakhir otomatis pada batas waktunya.

## Setelah ujian
1. **Ekspor** — data peserta (Excel), hasil (Excel), rekap (PDF), statistik (PDF), laporan per peserta (PDF).
   Laporan satu peserta juga dari menu **Hasil → Detail**.
2. Simpan file ekspor di tempat aman (tidak ada backup otomatis di paket gratis).
3. **Pengaturan Akun → Penghapusan data** bila kegiatan selesai: hapus hasil, lalu (opsional) hapus akun peserta.
   Semua tercatat di audit log.

## Keamanan
- Jangan bagikan akun admin. Ganti password di **Pengaturan Akun**.
- `SUPABASE_SERVICE_ROLE_KEY` hanya ada di Vercel; jangan pernah ditaruh di repo atau dibagikan.
