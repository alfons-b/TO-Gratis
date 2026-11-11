import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/** Pastikan kunci yang dipakai benar-benar kunci rahasia (service role / secret). */
function checkServiceKey(key: string) {
  if (key.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY berisi publishable key. Gunakan secret key (sb_secret_…) atau service_role key.",
    );
  }
  if (key.startsWith("sb_secret_")) return;
  const parts = key.split(".");
  if (parts.length !== 3) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY tidak valid (terpotong/salah salin?).");
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: string };
    if (payload.role !== "service_role") {
      throw new Error(
        `SUPABASE_SERVICE_ROLE_KEY berisi kunci dengan role "${payload.role ?? "?"}". Gunakan kunci service_role, bukan anon.`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("SUPABASE_SERVICE_ROLE_KEY")) throw e;
    throw new Error("SUPABASE_SERVICE_ROLE_KEY tidak valid (terpotong/salah salin?).");
  }
}

/**
 * Klien dengan SERVICE ROLE KEY. Melewati RLS.
 * HANYA dipakai di server (Server Actions) setelah pemanggil diverifikasi sebagai admin.
 */
export function createServiceClient() {
  const url = supabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server.");
  }
  checkServiceKey(key);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
