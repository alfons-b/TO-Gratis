#!/usr/bin/env node
/**
 * Uji beban sederhana: N peserta login -> token -> mulai -> menjawab 110 soal -> submit.
 * JALANKAN HANYA PADA PROYEK SUPABASE UJI (bukan proyek produksi saat kegiatan berlangsung).
 *
 * Prasyarat:
 *  - Ujian sudah DIBUKA, token aktif, 110 soal lengkap.
 *  - Akun uji sudah dibuat, mis. lewat "Tambah banyak" dengan pola: Uji 1;uji1;password123 ...
 *
 * Pemakaian:
 *   npm i  (sekali, di folder proyek)
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... TOKEN=ABC123 PREFIX=uji PASSWORD=password123 COUNT=200 \
 *   node scripts/load-test.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  TOKEN,
  PREFIX = "uji",
  PASSWORD,
  COUNT = "200",
  EMAIL_DOMAIN = "akun.tryout-skd.example.com",
} = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TOKEN || !PASSWORD) {
  console.error("Isi SUPABASE_URL, SUPABASE_ANON_KEY, TOKEN, PASSWORD.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = { ok: 0, fail: 0, saveCalls: 0, saveMs: [], errors: {} };
const note = (k) => (stats.errors[k] = (stats.errors[k] ?? 0) + 1);

async function participant(i) {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const device = randomUUID();
  const email = `${PREFIX}${i}@${EMAIL_DOMAIN}`;
  const { error: le } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (le) return note(`login: ${le.message}`);

  const { data: tok } = await sb.rpc("verify_exam_token", { p_token: TOKEN });
  if (!tok?.ok && tok?.error !== "ALREADY_STARTED") return note(`token: ${tok?.error}`);

  const { data: st } = await sb.rpc("start_exam_session", { p_device_id: device });
  if (!st?.ok) return note(`start: ${st?.error}`);

  const { data: state } = await sb.rpc("get_session_state", { p_device_id: device });
  if (state?.state !== "active") return note(`state: ${state?.state}`);
  const sid = state.session_id;

  const { data: qs, error: qe } = await sb.rpc("get_exam_questions", { p_session_id: sid });
  if (qe) return note(`questions: ${qe.message}`);

  for (const q of qs) {
    await sleep(200 + Math.random() * 800); // jeda "berpikir" singkat
    const t0 = Date.now();
    const { data, error } = await sb.rpc("save_answers", {
      p_session_id: sid,
      p_device_id: device,
      p_items: [{ question_id: q.id, option: "ABCDE"[Math.floor(Math.random() * 5)], client_ts: new Date().toISOString() }],
    });
    stats.saveCalls++;
    stats.saveMs.push(Date.now() - t0);
    if (error || !data?.ok) note(`save: ${error?.message ?? data?.error}`);
  }

  const { data: sub } = await sb.rpc("submit_exam", { p_session_id: sid, p_device_id: device });
  if (!sub?.ok) return note(`submit: ${sub?.error}`);
  const { data: res } = await sb.rpc("get_my_result");
  if (res?.status === "submitted") stats.ok++;
  else note(`result: ${res?.status}`);
}

const n = Number(COUNT);
console.log(`Menjalankan ${n} peserta paralel…`);
const t = Date.now();
await Promise.all(
  Array.from({ length: n }, (_, k) =>
    sleep(Math.random() * 30_000).then(() => participant(k + 1).catch((e) => note(`exception: ${e.message}`))),
  ),
);
stats.fail = n - stats.ok;
const sorted = stats.saveMs.sort((a, b) => a - b);
const pct = (p) => sorted[Math.floor((sorted.length - 1) * p)] ?? 0;
console.log({
  durasi_detik: Math.round((Date.now() - t) / 1000),
  sukses: stats.ok,
  gagal: stats.fail,
  panggilan_simpan: stats.saveCalls,
  simpan_ms_p50: pct(0.5),
  simpan_ms_p95: pct(0.95),
  simpan_ms_maks: sorted.at(-1),
  galat: stats.errors,
});
