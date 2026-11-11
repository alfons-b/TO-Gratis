/**
 * URL proyek Supabase dinormalisasi ke origin saja (https://xxxx.supabase.co).
 * Mencegah galat "Invalid path specified in request URL" bila env berisi
 * path tambahan seperti /rest/v1/ atau garis miring di akhir.
 */
export function supabaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

export function supabaseAnonKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
}
