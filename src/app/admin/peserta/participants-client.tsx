"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, Power, Trash2, Users } from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { ParticipantStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { ParticipantRow } from "@/lib/types";
import {
  createParticipant,
  createParticipantsBulk,
  deleteParticipant,
  resetParticipantPassword,
  setParticipantActive,
  updateParticipant,
} from "../actions";

const PAGE_SIZE = 25;

type Dialog =
  | { kind: "create" }
  | { kind: "bulk" }
  | { kind: "edit"; row: ParticipantRow }
  | { kind: "password"; row: ParticipantRow }
  | { kind: "delete"; row: ParticipantRow }
  | { kind: "credential"; username: string; password: string }
  | null;

export function ParticipantsClient({ rows }: { rows: ParticipantRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => r.full_name.toLowerCase().includes(t) || r.username.includes(t)) : rows;
  }, [rows, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const view = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function done(res: { ok: boolean; error?: string; message?: string }, close = true) {
    if (res.ok) {
      setNotice({ tone: "success", text: res.message ?? "Berhasil." });
      if (close) setDialog(null);
      router.refresh();
    } else setNotice({ tone: "danger", text: res.error ?? "Gagal." });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Peserta</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} akun · {rows.filter((r) => r.is_active).length} aktif
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDialog({ kind: "bulk" })}>
            <Users /> Tambah banyak
          </Button>
          <Button onClick={() => setDialog({ kind: "create" })}>
            <Plus /> Tambah peserta
          </Button>
        </div>
      </div>

      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

      <Card>
        <CardHeader>
          <Input
            placeholder="Cari nama atau username…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">No</th>
                  <th className="py-2 pr-3">Nama</th>
                  <th className="py-2 pr-3">Username</th>
                  <th className="py-2 pr-3">Status akun</th>
                  <th className="py-2 pr-3">Status ujian</th>
                  <th className="py-2 pr-3 text-right">Nilai</th>
                  <th className="py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {view.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      Belum ada peserta.
                    </td>
                  </tr>
                ) : (
                  view.map((r) => (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 tabular-nums">{r.participant_no ?? "-"}</td>
                      <td className="py-2 pr-3 font-medium">{r.full_name}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{r.username}</td>
                      <td className="py-2 pr-3">
                        <Badge tone={r.is_active ? "success" : "danger"}>{r.is_active ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      <td className="py-2 pr-3">
                        <ParticipantStatusBadge status={r.exam_status} />
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.total_score ?? "-"}</td>
                      <td className="py-2">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" title="Edit" onClick={() => setDialog({ kind: "edit", row: r })}>
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Reset password"
                            onClick={() => setDialog({ kind: "password", row: r })}
                          >
                            <KeyRound />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title={r.is_active ? "Nonaktifkan" : "Aktifkan"}
                            disabled={pending}
                            onClick={() =>
                              startTransition(async () =>
                                done(await setParticipantActive({ id: r.id, active: !r.is_active }), false),
                              )
                            }
                          >
                            <Power className={r.is_active ? "text-success" : "text-destructive"} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Hapus"
                            onClick={() => setDialog({ kind: "delete", row: r })}
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {pages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Halaman {page + 1} dari {pages} · {filtered.length} data
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Sebelumnya
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                  Berikutnya
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {dialog?.kind === "create" ? (
        <CreateDialog
          onClose={() => setDialog(null)}
          onCreated={(username, password) => {
            setDialog({ kind: "credential", username, password });
            setNotice({ tone: "success", text: "Akun peserta dibuat." });
            router.refresh();
          }}
        />
      ) : null}
      {dialog?.kind === "bulk" ? (
        <BulkDialog
          onClose={() => setDialog(null)}
          onDone={() => router.refresh()}
        />
      ) : null}
      {dialog?.kind === "edit" ? (
        <EditDialog row={dialog.row} onClose={() => setDialog(null)} onSaved={(r) => done(r)} />
      ) : null}
      {dialog?.kind === "password" ? (
        <PasswordDialog
          row={dialog.row}
          onClose={() => setDialog(null)}
          onSaved={(password) => setDialog({ kind: "credential", username: dialog.row.username, password })}
        />
      ) : null}
      {dialog?.kind === "delete" ? (
        <Modal open onClose={() => setDialog(null)} title="Hapus peserta?">
          <p className="text-sm">
            Akun <b>{dialog.row.full_name}</b> (@{dialog.row.username}) beserta sesi, jawaban, dan hasil ujiannya akan
            dihapus permanen.
          </p>
          {dialog.row.session_id ? (
            <Alert tone="warning" className="mt-3">
              Peserta ini sudah memiliki hasil/sesi ujian. Ekspor hasil terlebih dahulu bila diperlukan.
            </Alert>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => startTransition(async () => done(await deleteParticipant({ id: dialog.row.id })))}
            >
              Hapus permanen
            </Button>
          </div>
        </Modal>
      ) : null}
      {dialog?.kind === "credential" ? (
        <Modal open onClose={() => setDialog(null)} title="Catat kredensial">
          <p className="text-sm text-muted-foreground">
            Password tidak akan ditampilkan lagi. Berikan kepada peserta secara langsung.
          </p>
          <div className="mt-3 rounded-md bg-muted p-3 font-mono text-sm">
            <p>Username: {dialog.username}</p>
            <p>Password: {dialog.password}</p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => navigator.clipboard?.writeText(`Username: ${dialog.username}\nPassword: ${dialog.password}`)}
            >
              Salin
            </Button>
            <Button onClick={() => setDialog(null)}>Selesai</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function CreateDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (username: string, password: string) => void;
}) {
  const [form, setForm] = useState({ full_name: "", username: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Modal open onClose={onClose} title="Tambah peserta">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await createParticipant(form);
            if (res.ok) onCreated(form.username.trim().toLowerCase(), form.password);
            else setError(res.error);
          });
        }}
      >
        <Field label="Nama lengkap" htmlFor="c-name">
          <Input id="c-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        </Field>
        <Field label="Username" htmlFor="c-user" hint="Huruf kecil, angka, titik, garis bawah. 3–32 karakter. Harus unik.">
          <Input
            id="c-user"
            autoCapitalize="none"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </Field>
        <Field label="Password" htmlFor="c-pass" hint="Minimal 6 karakter. Buat berbeda untuk setiap peserta.">
          <PasswordInput id="c-pass" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
        </Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function BulkDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Modal open onClose={onClose} title="Tambah banyak peserta" wide>
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Satu peserta per baris dengan format <code className="rounded bg-muted px-1">Nama Lengkap;username;password</code>{" "}
          (pemisah titik koma atau Tab — bisa ditempel langsung dari kolom spreadsheet). Simpan daftar ini di tempat
          aman; password tidak dapat dilihat lagi setelah disimpan.
        </p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-56 font-mono text-xs"
          placeholder={"Budi Santoso;budi.s;k7m2qp9x\nSiti Aminah;siti.a;r4tw8nza"}
        />
        {error ? <p className="text-destructive">{error}</p> : null}
        {result ? (
          <Alert tone={result.errors.length ? "warning" : "success"}>
            <p>{result.created} akun berhasil dibuat.</p>
            {result.errors.length ? (
              <ul className="mt-2 list-disc pl-5 text-destructive">
                {result.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
          <Button
            disabled={pending || !text.trim()}
            onClick={() =>
              start(async () => {
                setError(null);
                setResult(null);
                // Diproses per 20 baris agar tiap permintaan server tetap singkat
                const lines = text.split(/\r?\n/).filter((l) => l.trim());
                const total = { created: 0, errors: [] as string[] };
                for (let i = 0; i < lines.length; i += 20) {
                  const chunk = lines.slice(i, i + 20);
                  const res = await createParticipantsBulk(chunk.join("\n"));
                  if (!res.ok) {
                    total.errors.push(`Baris ${i + 1}–${i + chunk.length}: ${res.error}`);
                    continue;
                  }
                  total.created += res.data!.created;
                  total.errors.push(
                    ...res.data!.errors.map((e) => e.replace(/^Baris (\d+)/, (_, n) => `Baris ${Number(n) + i}`)),
                  );
                  setResult({ ...total, errors: [...total.errors] });
                }
                setResult(total);
                onDone();
              })
            }
          >
            {pending ? "Memproses… (bisa 1–2 menit)" : "Buat akun"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditDialog({
  row,
  onClose,
  onSaved,
}: {
  row: ParticipantRow;
  onClose: () => void;
  onSaved: (res: { ok: boolean; error?: string; message?: string }) => void;
}) {
  const [form, setForm] = useState({ full_name: row.full_name, username: row.username });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Modal open onClose={onClose} title="Edit peserta">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await updateParticipant({ id: row.id, ...form });
            if (res.ok) onSaved(res);
            else setError(res.error);
          });
        }}
      >
        <Field label="Nama lengkap" htmlFor="e-name">
          <Input id="e-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </Field>
        <Field label="Username" htmlFor="e-user">
          <Input id="e-user" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending}>
            Simpan
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordDialog({
  row,
  onClose,
  onSaved,
}: {
  row: ParticipantRow;
  onClose: () => void;
  onSaved: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Modal open onClose={onClose} title={`Reset password @${row.username}`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await resetParticipantPassword({ id: row.id, password });
            if (res.ok) onSaved(password);
            else setError(res.error);
          });
        }}
      >
        <Field label="Password baru" htmlFor="p-pass">
          <PasswordInput id="p-pass" value={password} onChange={setPassword} />
        </Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending}>
            Simpan password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
