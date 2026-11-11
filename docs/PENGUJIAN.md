# Dokumentasi Pengujian

## A. Pengujian database (sudah dijalankan saat pengembangan)
Migration diuji pada PostgreSQL 16 dengan tiruan skema `auth` Supabase. Hasil:

| Skenario | Hasil |
|---|---|
| Buka ujian tanpa token → ditolak dengan daftar validasi | ✅ |
| Ubah soal / durasi / status langsung setelah ujian dibuka → ditolak trigger | ✅ |
| Peserta membaca tabel `questions` langsung → 0 baris (kunci tidak bocor) | ✅ |
| Peserta hanya melihat profil & sesi sendiri | ✅ |
| Mulai tanpa token → `TOKEN_REQUIRED`; token salah → `INVALID_TOKEN`; token huruf kecil + spasi → diterima | ✅ |
| Mulai dua kali → sesi yang sama (`existing: true`) | ✅ |
| Perangkat kedua saat perangkat pertama aktif → `locked` | ✅ |
| `get_exam_questions` → 110 soal tanpa `correct_answer`/`tkp_scores` | ✅ |
| Simpan 27 jawaban; perubahan bertanggal lama tidak menimpa; perangkat salah ditolak | ✅ |
| Peserta mengubah `total_score` / insert jawaban langsung → ditolak RLS | ✅ |
| Submit → TWK 50, TIU 50, TKP 26, total 126, benar 20, salah 1, kosong 83 (sesuai perhitungan manual) | ✅ |
| Submit ulang tidak menilai ulang; simpan setelah submit → `SESSION_CLOSED` | ✅ |
| Lewat deadline → otomatis `timed_out` & dinilai | ✅ |
| 5 token salah → `TOO_MANY_ATTEMPTS` | ✅ |
| Peserta memanggil fungsi admin/internal → ditolak | ✅ |
| Tutup ujian → peserta belum mulai menjadi "Tidak mengikuti"; audit log tercatat | ✅ |
| Hapus hasil → sesi terhapus, status kembali draft | ✅ |

## B. Uji manual end-to-end (lakukan setelah deploy)
Gunakan 2–3 akun uji dan jadwal singkat (mis. berakhir 30 menit lagi, durasi 10 menit).

| # | Skenario PRD | Langkah | Harapan |
|---|---|---|---|
| 1 | Login | Login peserta | Diminta token |
| 2 | Token salah | Masukkan token acak | Ditolak, tidak ada sesi |
| 3 | Mulai | Token benar → instruksi → Mulai | Timer berjalan |
| 4 | Refresh | Refresh di tengah ujian | Sesi & jawaban sama, timer lanjut |
| 5 | Perangkat kedua | Login akun sama di HP lain → buka ujian | Pesan "aktif di perangkat lain" |
| 6 | Internet putus | Mode pesawat, jawab 3 soal, matikan mode pesawat | "Menunggu koneksi" → "Tersimpan"; cek nilai |
| 7 | Waktu habis | Biarkan timer habis | Otomatis ke halaman hasil |
| 8 | Batas ujian | Mulai saat sisa periode < durasi | Timer = sisa periode |
| 9 | Manipulasi | Lihat DevTools: tidak ada kunci di respons soal; panggil `update exam_sessions` lewat API → gagal | Ditolak |
| 10 | Admin tutup | Peserta sedang mengerjakan → admin Tutup ujian | Sesi peserta selesai & dinilai |
| — | Ekspor | Unduh semua jenis ekspor | File terbuka benar, tanpa password |
| — | Akun nonaktif | Nonaktifkan akun → coba login | Ditolak |

## C. Uji beban 200 peserta
`scripts/load-test.mjs` mensimulasikan N peserta (login → token → mulai → 110 jawaban → submit).
Jalankan pada proyek Supabase **uji**, dengan rate limit Auth sudah dinaikkan (skrip berjalan dari satu IP).

```bash
npm install
SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=... TOKEN=ABC123 \
PREFIX=uji PASSWORD=password123 COUNT=200 node scripts/load-test.mjs
```
Buat akun `uji1…uji200` lewat *Tambah banyak* (format `Uji 1;uji1;password123`). Target: `gagal: 0`,
`simpan_ms_p95` < 1500 ms. Setelah itu hapus hasil & akun uji.
