# Platform Simulasi Try Out SKD CPNS

Aplikasi web untuk satu kali pelaksanaan simulasi SKD CPNS: 200 peserta + 1 administrator, 110 soal
(TWK 30 · TIU 35 · TKP 45), timer berbasis waktu server, autosave dengan antrean offline, penilaian otomatis
di database, dan ekspor Excel/PDF. Berjalan di **Vercel Hobby + Supabase Free**.

## Teknologi
Next.js 15 (App Router, TypeScript) · Tailwind CSS 4 · komponen bergaya shadcn/ui · Supabase (PostgreSQL,
Auth, RLS, RPC) · Zod · ExcelJS · jsPDF · Recharts · Lucide · IndexedDB.

## Struktur
```
supabase/migrations/      skema, RLS, fungsi ujian & penilaian (jalankan sekali)
supabase/optional/        pg_cron untuk finalisasi otomatis (opsional)
src/app/                  halaman: login, /setup, /peserta, /ujian, /admin/*
src/app/admin/actions.ts  server actions admin (validasi Zod, service role hanya di server)
src/app/ujian/            mesin ujian (timer server, autosave, offline queue, heartbeat)
src/lib/                  klien Supabase, utilitas, ekspor, antrean IndexedDB
docs/                     deployment, panduan admin & peserta, database & penilaian, pengujian
scripts/load-test.mjs     uji beban N peserta
```

## Menjalankan
1. Ikuti **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** (GitHub → Supabase → Vercel → `/setup`).
2. Lokal (opsional): `cp .env.example .env.local`, isi nilainya, `npm install`, `npm run dev`.

## Dokumentasi
- [Deployment](docs/DEPLOYMENT.md)
- [Panduan administrator](docs/PANDUAN-ADMIN.md)
- [Panduan peserta](docs/PANDUAN-PESERTA.md)
- [Database, penilaian, environment variables](docs/DATABASE.md)
- [Template konfigurasi ujian](docs/template-konfigurasi-ujian.md)
- [Pengujian](docs/PENGUJIAN.md)

## Prinsip keamanan
- Kunci jawaban & bobot TKP tidak pernah dikirim ke browser; peserta membaca soal via RPC tanpa kunci.
- Semua aturan penting (satu kesempatan, deadline, satu perangkat, penguncian soal, penilaian) ditegakkan di
  database, bukan di frontend.
- RLS aktif di semua tabel; peserta tidak bisa menulis nilai/sesi/jawaban secara langsung.
- `SUPABASE_SERVICE_ROLE_KEY` hanya dipakai di server actions setelah verifikasi admin.
- Password dikelola Supabase Auth; tidak disimpan/diekspor aplikasi. Token ujian disimpan sebagai hash bcrypt.
