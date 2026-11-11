# Panduan Deployment (GitHub → Supabase → Vercel)

Estimasi waktu: 20–30 menit. Semua layanan memakai paket gratis.

## 1. GitHub
1. Buat repository baru (disarankan **Private**), mis. `tryout-skd`. Jangan centang "Add README".
2. Unggah seluruh isi folder proyek ini (tanpa `node_modules`, `.next`, `.env*`). Cara termudah tanpa terminal:
   halaman repo kosong → **uploading an existing file** → seret semua file & folder → *Commit changes*.
   Dengan terminal:
   ```bash
   git init && git add . && git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<akun>/tryout-skd.git
   git push -u origin main
   ```

## 2. Supabase
1. https://supabase.com → **New project**. Region: **Southeast Asia (Singapore)**. Simpan database password.
2. **SQL Editor → New query** → tempel seluruh isi `supabase/migrations/20261111000000_init.sql` → **Run**.
   Harus selesai tanpa error ("Success. No rows returned").
3. (Opsional) aktifkan **Database → Extensions → pg_cron**, lalu jalankan `supabase/optional/pg_cron_finalize.sql`.
4. **Authentication → Sign In / Providers → Email**:
   - Matikan **Allow new users to sign up** (akun hanya dibuat admin).
   - Matikan **Confirm email**.
5. **Authentication → Rate Limits** — PENTING bila peserta berada di satu jaringan (satu IP, mis. Wi-Fi sekolah):
   - *Sign-ups and sign-ins*: naikkan ke **≥ 300 per 5 menit**.
   - *Token refreshes*: naikkan ke **≥ 600 per 5 menit**.
6. **Authentication → Sessions / JWT expiry** (bila tersedia): set **7200** detik agar token tidak perlu
   diperbarui di tengah ujian 100 menit.
7. **Project Settings → API** (atau **API Keys**): catat
   - Project URL
   - `anon` / *publishable* key
   - `service_role` / *secret* key (RAHASIA)

## 3. Vercel
1. https://vercel.com → **Add New → Project** → impor repo GitHub tadi. Framework: Next.js (otomatis).
2. **Environment Variables** (Production + Preview):

   | Nama | Nilai |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key |
   | `SETUP_SECRET` | kata acak panjang, mis. hasil password generator |
   | `NEXT_PUBLIC_APP_NAME` | nama platform dari pemilik produk |
   | `NEXT_PUBLIC_LOGO_URL` | (opsional) URL HTTPS logo |

3. **Deploy**. Setelah selesai, buka `https://<proyek>.vercel.app`.

## 4. Akun administrator
1. Buka `https://<proyek>.vercel.app/setup`.
2. Isi kode setup (`SETUP_SECRET`), nama, username, dan password admin → **Buat akun administrator**.
3. Halaman `/setup` otomatis tidak bisa dipakai lagi setelah admin ada. `SETUP_SECRET` boleh dihapus dari
   Vercel setelahnya.
4. Login di halaman utama. Username disimpan dalam huruf kecil (mis. `Florata` → `florata`); saat login,
   huruf besar/kecil tidak berpengaruh.

## 5. Uji sebelum hari-H (wajib)
Ikuti `docs/PENGUJIAN.md`. Minimal: buat 2–3 akun uji, isi 110 soal, buka ujian dengan jadwal singkat,
kerjakan dari HP & laptop, uji refresh, mode pesawat, perangkat kedua, submit, waktu habis, tutup ujian,
dan ekspor. Setelah itu **Pengaturan Akun → Hapus hasil**, lalu siapkan jadwal sebenarnya.

## 6. Catatan free tier
- Supabase Free di-*pause* setelah 7 hari tanpa aktivitas. Buka dashboard/aplikasi 1–2 hari sebelum ujian.
- Supabase Free tidak punya backup otomatis → **ekspor hasil segera** setelah ujian ditutup.
- Vercel Hobby hanya untuk penggunaan non-komersial. Bila try out dikaitkan dengan layanan berbayar,
  gunakan Vercel Pro.
- Estimasi pemakaian 200 peserta: database < 30 MB (kuota 500 MB), egress < 1 GB (kuota 5 GB) bila gambar
  soal di-host di luar Supabase dan sudah dikompresi.
