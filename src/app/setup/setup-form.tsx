"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createFirstAdmin } from "./actions";

export function SetupForm() {
  const [form, setForm] = useState({ secret: "", full_name: "Administrator", username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-success">Akun administrator berhasil dibuat.</p>
        <Link href="/" className="font-medium text-primary underline">
          Masuk ke halaman login
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await createFirstAdmin(form);
    setLoading(false);
    if (res.ok) setDone(true);
    else setError(res.error);
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Kode setup (SETUP_SECRET)" htmlFor="secret">
        <Input id="secret" type="password" value={form.secret} onChange={set("secret")} required />
      </Field>
      <Field label="Nama" htmlFor="full_name">
        <Input id="full_name" value={form.full_name} onChange={set("full_name")} required />
      </Field>
      <Field label="Username admin" htmlFor="username" hint="Disimpan dalam huruf kecil.">
        <Input id="username" autoCapitalize="none" value={form.username} onChange={set("username")} required />
      </Field>
      <Field label="Password admin" htmlFor="password" hint="Minimal 8 karakter.">
        <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} required />
      </Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Membuat…" : "Buat akun administrator"}
      </Button>
    </form>
  );
}
