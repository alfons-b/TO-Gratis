"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import type { TimezoneId } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { changeAdminPassword, deleteAllParticipants, deleteExamResults } from "../actions";

export function AccountClient({
  username,
  timezone,
  logs,
}: {
  username: string;
  timezone: TimezoneId;
  logs: { id: string; action: string; target_type: string | null; metadata: Record<string, unknown>; created_at: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [delResults, setDelResults] = useState("");
  const [delPeople, setDelPeople] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  function report(res: { ok: boolean; error?: string; message?: string }) {
    setNotice(res.ok ? { tone: "success", text: res.message ?? "Berhasil." } : { tone: "danger", text: res.error ?? "Gagal." });
    router.refresh();
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Pengaturan Akun</h1>
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Ganti password administrator</CardTitle>
          <CardDescription>Login sebagai @{username}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await changeAdminPassword(pw);
                report(res);
                if (res.ok) setPw({ password: "", confirm: "" });
              });
            }}
          >
            <Field label="Password baru" htmlFor="np">
              <Input id="np" type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
            </Field>
            <Field label="Ulangi password" htmlFor="cp">
              <Input id="cp" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending || !pw.password}>
                Simpan password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Penghapusan data</CardTitle>
          <CardDescription>
            Ekspor hasil terlebih dahulu di menu Ekspor. Data tidak pernah dihapus otomatis. Setiap penghapusan
            tercatat di audit log.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">1. Hapus semua hasil ujian</p>
            <p className="text-sm text-muted-foreground">
              Menghapus seluruh sesi, jawaban, dan nilai. Akun peserta dan bank soal tetap ada. Status ujian kembali ke
              draft.
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder='Ketik "HAPUS HASIL"'
                value={delResults}
                onChange={(e) => setDelResults(e.target.value)}
                className="max-w-xs"
              />
              <Button
                variant="destructive"
                disabled={pending || delResults.trim().toUpperCase() !== "HAPUS HASIL"}
                onClick={() =>
                  start(async () => {
                    report(await deleteExamResults(delResults));
                    setDelResults("");
                  })
                }
              >
                Hapus hasil
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">2. Hapus semua akun peserta</p>
            <p className="text-sm text-muted-foreground">
              Menghapus seluruh akun peserta beserta sesi dan hasilnya. Akun administrator tidak terhapus.
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder='Ketik "HAPUS PESERTA"'
                value={delPeople}
                onChange={(e) => setDelPeople(e.target.value)}
                className="max-w-xs"
              />
              <Button
                variant="destructive"
                disabled={pending || delPeople.trim().toUpperCase() !== "HAPUS PESERTA"}
                onClick={() =>
                  start(async () => {
                    report(await deleteAllParticipants(delPeople));
                    setDelPeople("");
                  })
                }
              >
                {pending ? "Menghapus…" : "Hapus peserta"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit log (50 terakhir)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Waktu</th>
                  <th className="py-2 pr-3">Aktivitas</th>
                  <th className="py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border/60">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{formatDateTime(l.created_at, timezone)}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs">{l.action}</td>
                    <td className="py-1.5 font-mono text-xs text-muted-foreground">
                      {Object.keys(l.metadata ?? {}).length ? JSON.stringify(l.metadata) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
