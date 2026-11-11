"use server";

import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";
import { normalizeUsername, usernameToEmail, USERNAME_REGEX } from "@/lib/utils";

const schema = z.object({
  secret: z.string().min(1),
  full_name: z.string().trim().min(1).max(120),
  username: z.string().transform(normalizeUsername).refine((u) => USERNAME_REGEX.test(u), {
    message: "Username 3–32 karakter: huruf kecil, angka, titik, garis bawah.",
  }),
  password: z.string().min(8, "Password minimal 8 karakter.").max(72),
});

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function createFirstAdmin(input: z.input<typeof schema>): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const { secret, full_name, username, password } = parsed.data;

  const expected = process.env.SETUP_SECRET;
  if (!expected || !safeEqual(secret, expected)) return { ok: false, error: "Kode setup salah." };

  const svc = createServiceClient();
  const { count } = await svc.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
  if ((count ?? 0) > 0) return { ok: false, error: "Administrator sudah ada." };

  const { data, error } = await svc.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error || !data.user) return { ok: false, error: error?.message ?? "Gagal membuat akun." };

  const { error: pErr } = await svc.from("profiles").insert({
    id: data.user.id,
    username,
    full_name,
    role: "admin",
    is_active: true,
  });
  if (pErr) {
    await svc.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: pErr.message };
  }
  await svc.from("audit_logs").insert({
    actor_id: data.user.id,
    action: "admin.setup",
    target_type: "profile",
    target_id: data.user.id,
  });
  return { ok: true };
}
