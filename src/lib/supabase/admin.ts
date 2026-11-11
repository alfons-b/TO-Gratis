import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Klien dengan SERVICE ROLE KEY. Melewati RLS.
 * HANYA dipakai di server (Server Actions) setelah pemanggil diverifikasi sebagai admin.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
