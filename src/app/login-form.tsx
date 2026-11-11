"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { normalizeUsername, usernameToEmail, USERNAME_REGEX } from "@/lib/utils";

/**
 * Login dilakukan dari browser peserta (bukan dari server Vercel) agar batas laju
 * login Supabase dihitung per IP peserta, bukan satu IP server untuk 200 orang.
 */
export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const u = normalizeUsername(username);
    if (!USERNAME_REGEX.test(u) || !password) {
      setError("Username atau password salah.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(u),
      password,
    });
    if (err || !data.user) {
      setLoading(false);
      if (err?.status === 429) setError("Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.");
      else setError("Username atau password salah, atau akun tidak aktif.");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role,is_active")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!profile || !profile.is_active) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Akun tidak aktif. Hubungi panitia.");
      return;
    }
    router.replace(profile.role === "admin" ? "/admin" : "/peserta");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Username" htmlFor="username">
        <Input
          id="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <div className="relative">
          <Input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-11"
            required
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground"
            aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        <LogIn /> {loading ? "Memproses…" : "Masuk"}
      </Button>
    </form>
  );
}
