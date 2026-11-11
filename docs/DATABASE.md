# Dokumentasi Database, Penilaian, dan Environment

Migration: `supabase/migrations/20261111000000_init.sql` (tabel, index, trigger, fungsi, RLS, grant).

## Tabel
| Tabel | Isi | Catatan |
|---|---|---|
| `profiles` | id (= auth.users.id), username unik, full_name, role (`admin`/`participant`), participant_no, is_active | Password **tidak** di sini; dikelola Supabase Auth |
| `exams` | judul, deskripsi, start_at, end_at, timezone, duration_minutes, status (`draft`/`open`/`closed`), scoring_config (passing grade) | Satu baris (satu pelaksanaan) |
| `exam_tokens` | token_hash (bcrypt), is_active | Token mentah tidak pernah disimpan |
| `questions` | subtest, question_number, question_text, image_url, options {A..E}, correct_answer, tkp_scores {A..E} | Hanya admin yang bisa membaca (RLS) |
| `exam_access` | peserta yang sudah memasukkan token valid | |
| `token_attempts` | log percobaan token | Pembatas 5 gagal / 10 menit |
| `exam_sessions` | started_at, deadline_at, submitted_at, status (`in_progress`/`submitted`/`timed_out`), device_session_id, last_heartbeat_at, skor | `UNIQUE(exam_id, user_id)` = satu kesempatan |
| `answers` | selected_option, answered_at, score_obtained | `UNIQUE(session_id, question_id)`; ditulis hanya via `save_answers` (upsert) |
| `audit_logs` | actor_id, action, target, metadata | |

Relasi: `auth.users 1–1 profiles 1–n exam_sessions 1–n answers n–1 questions n–1 exams`; semua FK eksplisit
dengan `ON DELETE CASCADE` (kecuali audit_logs.actor → `SET NULL`).

## Aturan yang ditegakkan di database
- **Satu kesempatan**: constraint unik `exam_sessions(exam_id,user_id)`; pembuatan sesi atomik `INSERT … ON CONFLICT DO NOTHING`.
- **Timer server**: `deadline_at = LEAST(now() + durasi, end_at)` dihitung saat sesi dibuat. Klien hanya menampilkan.
- **Satu perangkat**: `device_session_id` + `last_heartbeat_at`. Perangkat lain ditolak selama heartbeat < 90 detik.
- **Autosave idempoten**: upsert per soal; perubahan lebih lama (berdasarkan `answered_at`, dibatasi ≤ waktu server) tidak menimpa yang lebih baru.
- **Penguncian**: trigger menolak perubahan `questions` dan jadwal/durasi/passing grade setelah ujian `open`/`closed`. Status ujian hanya bisa berubah lewat fungsi admin (yang memvalidasi).
- **Penilaian**: `finalize_session()` (tidak bisa dipanggil klien) mengunci baris sesi, menilai, dan tidak pernah menilai ulang sesi final.
- **Finalisasi otomatis**: sesi kedaluwarsa dinilai saat diakses (`get_session_state`, `heartbeat`, `save_answers`, `get_my_result`, daftar admin) dan opsional tiap menit via pg_cron.

## Fungsi RPC
Peserta: `public_exam_info`, `verify_exam_token`, `start_exam_session`, `get_session_state`,
`get_exam_questions` (tanpa kunci/bobot), `save_answers`, `heartbeat`, `submit_exam`, `get_my_result`.
Admin (memeriksa `is_admin()`): `admin_set_token`, `admin_set_token_active`, `admin_token_status`,
`admin_validate_exam`, `admin_open_exam`, `admin_close_exam`, `admin_unlock_exam`, `admin_release_device`,
`admin_list_participants`, `admin_dashboard_stats`, `admin_delete_exam_results`.
Internal (tidak diberikan ke klien): `finalize_session`, `finalize_expired`, `write_audit`.

## Sistem penilaian
| Subtes | Soal | Benar | Salah/kosong | Maks |
|---|---|---|---|---|
| TWK (1–30) | 30 | 5 | 0 | 150 |
| TIU (31–65) | 35 | 5 | 0 | 175 |
| TKP (66–110) | 45 | bobot pilihan 1–5 | kosong 0 | 225 |
| **Total** | 110 | | | **550** |

- `correct_count` / `incorrect_count` hanya menghitung TWK+TIU. TKP dilaporkan sebagai `tkp_answered_count`
  (jawaban yang memiliki skor), bukan benar/salah.
- `unanswered_count` = soal tanpa jawaban di ketiga subtes.
- `passed` = TWK ≥ `twk_min` **dan** TIU ≥ `tiu_min` **dan** TKP ≥ `tkp_min` **dan** total ≥ `total_min` (bila diisi).
- Passing grade disimpan di `exams.scoring_config` (lihat `docs/template-konfigurasi-ujian.md`), bukan di kode.

## Environment variables
| Nama | Di mana | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | URL proyek |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Kunci publik; aman karena RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **server saja** | Untuk membuat/mengubah akun Auth. Jangan pakai prefix `NEXT_PUBLIC_` |
| `SETUP_SECRET` | server | Kode sekali pakai untuk `/setup` |
| `NEXT_PUBLIC_APP_NAME` | browser | Nama platform |
| `NEXT_PUBLIC_LOGO_URL` | browser | Logo (opsional) |

## Login username tanpa email
Username dipetakan ke identitas internal `username@akun.tryout-skd.example.com` di Supabase Auth.
Alamat ini tidak pernah menerima email dan tidak perlu diketahui peserta. Password di-hash oleh Supabase Auth.
