import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
}

/** Untuk halaman: alihkan jika bukan admin aktif. */
export async function requireAdmin(): Promise<Profile> {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin" || !p.is_active) redirect("/");
  return p;
}

/** Untuk server action: lempar galat jika bukan admin aktif (tidak bergantung pada UI). */
export async function assertAdmin(): Promise<Profile> {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin" || !p.is_active) {
    throw new Error("Akses ditolak.");
  }
  return p;
}

export async function requireParticipant(): Promise<Profile> {
  const p = await getCurrentProfile();
  if (!p) redirect("/");
  if (p.role === "admin") redirect("/admin");
  if (!p.is_active) redirect("/?nonaktif=1");
  return p;
}
