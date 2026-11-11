"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

export function TokenForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await createClient().rpc("verify_exam_token", { p_token: token });
    const res = data as { ok: boolean; error?: string } | null;
    if (err || !res?.ok) {
      setLoading(false);
      if (res?.error === "ALREADY_STARTED") {
        router.replace("/ujian");
        return;
      }
      setError(errorMessage(res?.error));
      return;
    }
    router.push("/peserta/instruksi");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Token ujian" htmlFor="token" hint="Token diberikan oleh panitia saat ujian dibuka.">
        <Input
          id="token"
          value={token}
          onChange={(e) => setToken(e.target.value.toUpperCase())}
          autoComplete="off"
          autoCapitalize="characters"
          className="text-center font-mono text-lg tracking-[0.3em]"
          maxLength={32}
        />
      </Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" size="lg" className="w-full" disabled={loading || !token.trim()}>
        <KeyRound /> {loading ? "Memeriksa…" : "Kirim token"}
      </Button>
    </form>
  );
}
