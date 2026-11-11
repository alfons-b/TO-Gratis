"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  DashboardStats,
  Exam,
  OptionKey,
  ParticipantRow,
} from "@/lib/types";
import { normalizeUsername, subtestOf, usernameToEmail, USERNAME_REGEX } from "@/lib/utils";

// ---------------------------------------------------------------- helpers
const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .refine((u) => USERNAME_REGEX.test(u), {
    message: "Username 3–32 karakter: huruf kecil, angka, titik (.), garis bawah (_).",
  });
const passwordSchema = z.string().min(6, "Password minimal 6 karakter.").max(72, "Password maksimal 72 karakter.");
const nameSchema = z.string().trim().min(1, "Nama wajib diisi.").max(120);

function fail(e: unknown): ActionResult<never> {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Terjadi kesalahan.";
  return { ok: false, error: translateDbError(msg) };
}

function translateDbError(msg: string) {
  if (msg.includes("BANK_SOAL_TERKUNCI")) return "Bank soal terkunci karena ujian sudah dibuka.";
  if (msg.includes("PENGATURAN_TERKUNCI")) return "Jadwal, durasi, dan passing grade terkunci setelah ujian dibuka.";
  if (msg.includes("questions_active_number_uq")) return "Nomor soal tersebut sudah dipakai soal aktif lain.";
  if (msg.includes("profiles_username_key") || msg.includes("already been registered"))
    return "Username sudah digunakan.";
  if (msg.includes("FORBIDDEN")) return "Akses ditolak.";
  return msg;
}

async function audit(action: string, targetType: string, targetId: string | null, metadata: object = {}) {
  const admin = await assertAdmin();
  const svc = createServiceClient();
  await svc.from("audit_logs").insert({
    actor_id: admin.id,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });
}

// ---------------------------------------------------------------- data
export async function getParticipants(): Promise<ParticipantRow[]> {
  await assertAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_participants");
  if (error) throw new Error(error.message);
  return (data as ParticipantRow[]) ?? [];
}

export async function getDashboard(): Promise<{ stats: DashboardStats; participants: ParticipantRow[] }> {
  await assertAdmin();
  const supabase = await createClient();
  const [{ data: stats, error: e1 }, { data: rows, error: e2 }] = await Promise.all([
    supabase.rpc("admin_dashboard_stats"),
    supabase.rpc("admin_list_participants"),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  return { stats: stats as DashboardStats, participants: (rows as ParticipantRow[]) ?? [] };
}

// ---------------------------------------------------------------- peserta
async function nextParticipantNo(svc: ReturnType<typeof createServiceClient>) {
  const { data } = await svc
    .from("profiles")
    .select("participant_no")
    .eq("role", "participant")
    .order("participant_no", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return ((data?.participant_no as number | null) ?? 0) + 1;
}

async function createOne(
  svc: ReturnType<typeof createServiceClient>,
  input: { full_name: string; username: string; password: string },
  participantNo: number,
): Promise<ActionResult<{ id: string }>> {
  const { data, error } = await svc.auth.admin.createUser({
    email: usernameToEmail(input.username),
    password: input.password,
    email_confirm: true,
    user_metadata: { username: input.username },
  });
  if (error || !data.user) return { ok: false, error: translateDbError(error?.message ?? "Gagal membuat akun.") };
  const { error: pErr } = await svc.from("profiles").insert({
    id: data.user.id,
    username: input.username,
    full_name: input.full_name,
    role: "participant",
    participant_no: participantNo,
    is_active: true,
  });
  if (pErr) {
    await svc.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: translateDbError(pErr.message) };
  }
  return { ok: true, data: { id: data.user.id } };
}

const createSchema = z.object({ full_name: nameSchema, username: usernameSchema, password: passwordSchema });

export async function createParticipant(input: z.input<typeof createSchema>): Promise<ActionResult> {
  try {
    await assertAdmin();
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const svc = createServiceClient();
    const res = await createOne(svc, parsed.data, await nextParticipantNo(svc));
    if (!res.ok) return res;
    await audit("participant.create", "profile", res.data!.id, { username: parsed.data.username });
    revalidatePath("/admin/peserta");
    return { ok: true, message: "Akun peserta dibuat." };
  } catch (e) {
    return fail(e);
  }
}

/** Tambah banyak: setiap baris "Nama Lengkap;username;password" */
export async function createParticipantsBulk(
  text: string,
): Promise<ActionResult<{ created: number; errors: string[] }>> {
  try {
    await assertAdmin();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return { ok: false, error: "Tidak ada baris yang diisi." };
    if (lines.length > 250) return { ok: false, error: "Maksimal 250 baris sekali proses." };

    const svc = createServiceClient();
    let no = await nextParticipantNo(svc);
    let created = 0;
    const errors: string[] = [];
    for (const [i, line] of lines.entries()) {
      const parts = line.split(/[;\t]/).map((p) => p.trim());
      const parsed = createSchema.safeParse({ full_name: parts[0], username: parts[1] ?? "", password: parts[2] ?? "" });
      if (!parsed.success) {
        errors.push(`Baris ${i + 1}: ${parsed.error.issues[0].message}`);
        continue;
      }
      const res = await createOne(svc, parsed.data, no);
      if (res.ok) {
        created++;
        no++;
      } else errors.push(`Baris ${i + 1} (${parsed.data.username}): ${res.error}`);
    }
    await audit("participant.create_bulk", "profile", null, { created, failed: errors.length });
    revalidatePath("/admin/peserta");
    return { ok: true, data: { created, errors } };
  } catch (e) {
    return fail(e);
  }
}

const updateSchema = z.object({ id: z.string().uuid(), full_name: nameSchema, username: usernameSchema });

export async function updateParticipant(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  try {
    await assertAdmin();
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const { id, full_name, username } = parsed.data;
    const svc = createServiceClient();
    const { data: current } = await svc.from("profiles").select("username,role").eq("id", id).single();
    if (!current || current.role !== "participant") return { ok: false, error: "Peserta tidak ditemukan." };

    if (current.username !== username) {
      const { error } = await svc.auth.admin.updateUserById(id, {
        email: usernameToEmail(username),
        email_confirm: true,
        user_metadata: { username },
      });
      if (error) return { ok: false, error: translateDbError(error.message) };
    }
    const { error } = await svc.from("profiles").update({ full_name, username }).eq("id", id);
    if (error) {
      if (current.username !== username) {
        await svc.auth.admin.updateUserById(id, { email: usernameToEmail(current.username), email_confirm: true });
      }
      return { ok: false, error: translateDbError(error.message) };
    }
    await audit("participant.update", "profile", id, { username });
    revalidatePath("/admin/peserta");
    return { ok: true, message: "Data peserta diperbarui." };
  } catch (e) {
    return fail(e);
  }
}

export async function resetParticipantPassword(input: { id: string; password: string }): Promise<ActionResult> {
  try {
    await assertAdmin();
    const parsed = z.object({ id: z.string().uuid(), password: passwordSchema }).safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const svc = createServiceClient();
    const { data: p } = await svc.from("profiles").select("role").eq("id", parsed.data.id).single();
    if (!p || p.role !== "participant") return { ok: false, error: "Peserta tidak ditemukan." };
    const { error } = await svc.auth.admin.updateUserById(parsed.data.id, { password: parsed.data.password });
    if (error) return { ok: false, error: error.message };
    await audit("participant.reset_password", "profile", parsed.data.id);
    return { ok: true, message: "Password baru disimpan." };
  } catch (e) {
    return fail(e);
  }
}

export async function setParticipantActive(input: { id: string; active: boolean }): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = z.string().uuid().parse(input.id);
    const svc = createServiceClient();
    const { data: p } = await svc.from("profiles").select("role").eq("id", id).single();
    if (!p || p.role !== "participant") return { ok: false, error: "Peserta tidak ditemukan." };
    // Larang login (ban) agar akun nonaktif benar-benar tidak bisa masuk
    const { error: aErr } = await svc.auth.admin.updateUserById(id, {
      ban_duration: input.active ? "none" : "876000h",
    });
    if (aErr) return { ok: false, error: aErr.message };
    const { error } = await svc.from("profiles").update({ is_active: input.active }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await audit(input.active ? "participant.activate" : "participant.deactivate", "profile", id);
    revalidatePath("/admin/peserta");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteParticipant(input: { id: string }): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = z.string().uuid().parse(input.id);
    const svc = createServiceClient();
    const { data: p } = await svc.from("profiles").select("role,username").eq("id", id).single();
    if (!p || p.role !== "participant") return { ok: false, error: "Peserta tidak ditemukan." };
    // profiles, sesi, dan jawaban ikut terhapus (ON DELETE CASCADE)
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) return { ok: false, error: error.message };
    await audit("participant.delete", "profile", id, { username: p.username });
    revalidatePath("/admin/peserta");
    return { ok: true, message: "Peserta dihapus." };
  } catch (e) {
    return fail(e);
  }
}

export async function releaseDevice(sessionId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_release_device", { p_session_id: sessionId });
    if (error) return fail(error.message);
    return { ok: true, message: "Kunci perangkat dilepas. Peserta dapat melanjutkan di perangkat lain." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- bank soal
const optionText = z.string().trim().min(1, "Semua pilihan A–E wajib diisi.").max(4000);
const questionSchema = z
  .object({
    id: z.string().uuid().optional(),
    question_number: z.coerce.number().int().min(1).max(110),
    question_text: z.string().trim().min(1, "Pertanyaan wajib diisi.").max(10000),
    image_url: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^https:\/\/\S+$/i.test(v), { message: "URL gambar harus diawali https://" }),
    options: z.object({ A: optionText, B: optionText, C: optionText, D: optionText, E: optionText }),
    correct_answer: z.enum(["A", "B", "C", "D", "E"]).nullable().optional(),
    tkp_scores: z
      .object({
        A: z.coerce.number().int().min(1).max(5),
        B: z.coerce.number().int().min(1).max(5),
        C: z.coerce.number().int().min(1).max(5),
        D: z.coerce.number().int().min(1).max(5),
        E: z.coerce.number().int().min(1).max(5),
      })
      .nullable()
      .optional(),
    is_active: z.boolean().default(true),
  })
  .superRefine((q, ctx) => {
    const st = subtestOf(q.question_number);
    if (st !== "TKP" && !q.correct_answer)
      ctx.addIssue({ code: "custom", message: "Kunci jawaban wajib dipilih untuk TWK/TIU." });
    if (st === "TKP" && !q.tkp_scores)
      ctx.addIssue({ code: "custom", message: "Bobot A–E (1–5) wajib diisi untuk TKP." });
  });

export type QuestionInput = z.input<typeof questionSchema>;

export async function saveQuestion(input: QuestionInput): Promise<ActionResult<{ id: string }>> {
  try {
    await assertAdmin();
    const parsed = questionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const q = parsed.data;
    const subtest = subtestOf(q.question_number);
    const supabase = await createClient();
    const { data: examId } = await supabase.rpc("current_exam_id");
    const row = {
      exam_id: examId as string,
      subtest,
      question_number: q.question_number,
      question_text: q.question_text,
      image_url: q.image_url,
      options: q.options,
      correct_answer: subtest === "TKP" ? null : (q.correct_answer as OptionKey),
      tkp_scores: subtest === "TKP" ? q.tkp_scores : null,
      is_active: q.is_active,
    };
    const res = q.id
      ? await supabase.from("questions").update(row).eq("id", q.id).select("id").single()
      : await supabase.from("questions").insert(row).select("id").single();
    if (res.error) return fail(res.error.message);
    await audit(q.id ? "question.update" : "question.create", "question", res.data.id, {
      number: q.question_number,
    });
    revalidatePath("/admin/soal");
    return { ok: true, data: { id: res.data.id }, message: "Soal disimpan." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteQuestion(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("questions").delete().eq("id", z.string().uuid().parse(id));
    if (error) return fail(error.message);
    await audit("question.delete", "question", id);
    revalidatePath("/admin/soal");
    return { ok: true, message: "Soal dihapus." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- pengaturan ujian
const settingsSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional().transform((v) => v || null),
    start_at: z.string().datetime({ offset: true }),
    end_at: z.string().datetime({ offset: true }),
    timezone: z.enum(["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]),
    duration_minutes: z.coerce.number().int().min(1).max(600),
    scoring_config: z.object({
      category: z.string().trim().min(1).max(100),
      regulation_year: z.coerce.number().int().min(2000).max(2100).nullable(),
      regulation_reference: z.string().trim().max(300),
      twk_min: z.coerce.number().int().min(0).max(150),
      tiu_min: z.coerce.number().int().min(0).max(175),
      tkp_min: z.coerce.number().int().min(0).max(225),
      total_min: z.coerce.number().int().min(0).max(550).nullable(),
    }),
  })
  .refine((s) => new Date(s.end_at) > new Date(s.start_at), { message: "Waktu berakhir harus setelah waktu mulai." });

export async function saveExamSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  try {
    await assertAdmin();
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const supabase = await createClient();
    const { data: examId } = await supabase.rpc("current_exam_id");
    const { error } = await supabase.from("exams").update(parsed.data).eq("id", examId as string);
    if (error) return fail(error.message);
    await audit("exam.update_settings", "exam", examId as string, {
      start_at: parsed.data.start_at,
      end_at: parsed.data.end_at,
      duration: parsed.data.duration_minutes,
    });
    revalidatePath("/admin/ujian");
    return { ok: true, message: "Pengaturan disimpan." };
  } catch (e) {
    return fail(e);
  }
}

export async function getExam(): Promise<Exam> {
  await assertAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("exams").select("*").order("created_at").limit(1).single();
  if (error) throw new Error(error.message);
  return data as Exam;
}

export async function validateExam(): Promise<string[]> {
  await assertAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_validate_exam");
  if (error) throw new Error(error.message);
  return (data as string[]) ?? [];
}

export async function openExam(): Promise<ActionResult<{ errors?: string[] }>> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_open_exam");
    if (error) return fail(error.message);
    const res = data as { ok: boolean; errors?: string[] };
    revalidatePath("/admin", "layout");
    if (!res.ok) return { ok: false, error: (res.errors ?? []).join("\n") };
    return { ok: true, message: "Ujian dibuka. Bank soal dan pengaturan kini terkunci." };
  } catch (e) {
    return fail(e);
  }
}

export async function closeExam(confirmText: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    if (confirmText.trim().toUpperCase() !== "TUTUP") return { ok: false, error: 'Ketik "TUTUP" untuk konfirmasi.' };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_close_exam");
    if (error) return fail(error.message);
    revalidatePath("/admin", "layout");
    const n = (data as { finalized: number }).finalized;
    return { ok: true, message: `Ujian ditutup. ${n} sesi aktif difinalisasi dan dinilai.` };
  } catch (e) {
    return fail(e);
  }
}

export async function unlockExam(): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_unlock_exam");
    if (error) return fail(error.message);
    const res = data as { ok: boolean; error?: string };
    revalidatePath("/admin", "layout");
    if (!res.ok) return { ok: false, error: "Tidak dapat dikembalikan ke draft: sudah ada peserta yang memulai." };
    return { ok: true, message: "Ujian kembali ke draft. Bank soal dapat diubah." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- token
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O/1/I

export async function regenerateToken(customToken?: string): Promise<ActionResult<{ token: string }>> {
  try {
    await assertAdmin();
    let token = (customToken ?? "").trim().toUpperCase();
    if (token) {
      if (!/^[A-Z0-9]{4,32}$/.test(token)) return { ok: false, error: "Token 4–32 karakter huruf/angka." };
    } else {
      token = Array.from({ length: 6 }, () => TOKEN_ALPHABET[randomInt(TOKEN_ALPHABET.length)]).join("");
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_set_token", { p_token: token });
    if (error) return fail(error.message);
    if (!(data as { ok: boolean }).ok) return { ok: false, error: "Format token tidak valid." };
    revalidatePath("/admin/token");
    return { ok: true, data: { token } };
  } catch (e) {
    return fail(e);
  }
}

export async function setTokenActive(active: boolean): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_set_token_active", { p_active: active });
    if (error) return fail(error.message);
    if (!(data as { ok: boolean }).ok) return { ok: false, error: "Belum ada token." };
    revalidatePath("/admin/token");
    return { ok: true, message: active ? "Token diaktifkan." : "Token dinonaktifkan." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- ekspor
export async function getExportData(kind: string) {
  await assertAdmin();
  const supabase = await createClient();
  const [{ data: rows, error: e1 }, { data: stats, error: e2 }, { data: exam, error: e3 }] = await Promise.all([
    supabase.rpc("admin_list_participants"),
    supabase.rpc("admin_dashboard_stats"),
    supabase.from("exams").select("*").order("created_at").limit(1).single(),
  ]);
  if (e1 || e2 || e3) throw new Error((e1 ?? e2 ?? e3)!.message);
  await audit("data.export", "export", null, { kind });
  return {
    participants: (rows as ParticipantRow[]) ?? [],
    stats: stats as DashboardStats,
    exam: exam as Exam,
  };
}

// ---------------------------------------------------------------- akun & data
export async function changeAdminPassword(input: { password: string; confirm: string }): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const parsed = z
      .object({ password: z.string().min(8, "Password minimal 8 karakter.").max(72), confirm: z.string() })
      .refine((v) => v.password === v.confirm, { message: "Konfirmasi password tidak sama." })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const svc = createServiceClient();
    const { error } = await svc.auth.admin.updateUserById(admin.id, { password: parsed.data.password });
    if (error) return { ok: false, error: error.message };
    await audit("admin.change_password", "profile", admin.id);
    return { ok: true, message: "Password administrator diperbarui." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteExamResults(confirmText: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    if (confirmText.trim().toUpperCase() !== "HAPUS HASIL") return { ok: false, error: 'Ketik "HAPUS HASIL".' };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_delete_exam_results");
    if (error) return fail(error.message);
    revalidatePath("/admin", "layout");
    return { ok: true, message: `${(data as { sessions_deleted: number }).sessions_deleted} sesi & jawaban dihapus.` };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteAllParticipants(confirmText: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    if (confirmText.trim().toUpperCase() !== "HAPUS PESERTA") return { ok: false, error: 'Ketik "HAPUS PESERTA".' };
    const svc = createServiceClient();
    const { data: rows, error } = await svc.from("profiles").select("id").eq("role", "participant");
    if (error) return fail(error.message);
    let deleted = 0;
    for (const r of rows ?? []) {
      const { error: dErr } = await svc.auth.admin.deleteUser(r.id as string);
      if (!dErr) deleted++;
    }
    await audit("data.delete_participants", "profile", null, { deleted });
    revalidatePath("/admin", "layout");
    return { ok: true, message: `${deleted} akun peserta beserta hasilnya dihapus.` };
  } catch (e) {
    return fail(e);
  }
}
