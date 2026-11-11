-- OPSIONAL: finalisasi otomatis sesi yang melewati batas waktu setiap menit.
-- Tanpa ini sistem tetap benar: sesi yang kedaluwarsa dinilai saat peserta/admin
-- membuka halaman (lazy finalization). Ini hanya membuat dashboard selalu mutakhir.
-- Aktifkan: Supabase -> Database -> Extensions -> pg_cron, lalu jalankan file ini.

create extension if not exists pg_cron;

select cron.schedule(
  'finalize-expired-exam-sessions',
  '* * * * *',
  $$ select public.finalize_expired(); $$
);

-- Untuk menghentikan:
-- select cron.unschedule('finalize-expired-exam-sessions');
