# Template Konfigurasi Ujian

Isi melalui **Admin → Pengaturan Ujian** sebelum ujian dibuka.

| Field | Contoh | Catatan |
|---|---|---|
| Nama Try Out | Try Out SKD CPNS 2026 | Tampil di login, ujian, hasil, laporan |
| Informasi singkat | Simulasi gratis, 110 soal, 100 menit | Tampil di halaman login |
| Zona waktu | WIB (Asia/Jakarta) | WIB / WITA / WIT |
| Mulai | 2026-11-29 06:00 | |
| Berakhir | 2026-11-29 23:59 | Peserta yang mulai 23:00 hanya dapat 59 menit |
| Durasi normal | 100 | menit |
| Min TWK | 65 | **Verifikasi dengan regulasi berlaku** |
| Min TIU | 80 | |
| Min TKP | 166 | |
| Min kumulatif | (kosong) | Isi bila regulasi mensyaratkan |
| Kategori seleksi | Umum | |
| Tahun regulasi | 2024 | |
| Referensi regulasi | KepmenPANRB No. … | |

Nilai tersimpan di `exams.scoring_config`:

```json
{
  "category": "Umum",
  "regulation_year": 2024,
  "regulation_reference": "KepmenPANRB No. ...",
  "twk_min": 65,
  "tiu_min": 80,
  "tkp_min": 166,
  "total_min": null
}
```

## Checklist sebelum "Buka ujian"
- [ ] 110 soal aktif, nomor 1–110 terisi semua
- [ ] Semua TWK/TIU memiliki kunci; semua TKP memiliki bobot 1–5 untuk A–E
- [ ] Semua pilihan A–E terisi; semua gambar tampil di preview
- [ ] Jadwal & zona waktu benar; passing grade sudah diverifikasi
- [ ] Token dibuat dan dicatat
- [ ] Akun peserta dibuat dan kredensial dibagikan
- [ ] Uji coba end-to-end sudah dilakukan lalu hasil uji dihapus
