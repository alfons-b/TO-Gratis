"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Lock, CirclePlay, CircleStop, Undo2 } from "lucide-react";
import { ExamStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Exam, TimezoneId } from "@/lib/types";
import { isoToLocalInput, localInputToIso, TZ_LABEL } from "@/lib/utils";
import { closeExam, openExam, saveExamSettings, unlockExam } from "../actions";

export function ExamSettingsClient({
  exam,
  problems,
  sessionCount,
}: {
  exam: Exam;
  problems: string[];
  sessionCount: number;
}) {
  const router = useRouter();
  const locked = exam.status === "open" || exam.status === "closed";
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeText, setCloseText] = useState("");
  const [openConfirm, setOpenConfirm] = useState(false);

  const [tz, setTz] = useState<TimezoneId>(exam.timezone);
  const [form, setForm] = useState({
    title: exam.title,
    description: exam.description ?? "",
    start: isoToLocalInput(exam.start_at, exam.timezone),
    end: isoToLocalInput(exam.end_at, exam.timezone),
    duration_minutes: String(exam.duration_minutes),
    category: exam.scoring_config.category ?? "Umum",
    regulation_year: exam.scoring_config.regulation_year ? String(exam.scoring_config.regulation_year) : "",
    regulation_reference: exam.scoring_config.regulation_reference ?? "",
    twk_min: String(exam.scoring_config.twk_min ?? 0),
    tiu_min: String(exam.scoring_config.tiu_min ?? 0),
    tkp_min: String(exam.scoring_config.tkp_min ?? 0),
    total_min: exam.scoring_config.total_min != null ? String(exam.scoring_config.total_min) : "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function report(res: { ok: boolean; error?: string; message?: string }) {
    setNotice(res.ok ? { tone: "success", text: res.message ?? "Berhasil." } : { tone: "danger", text: res.error ?? "Gagal." });
    router.refresh();
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    const start_at = localInputToIso(form.start, tz);
    const end_at = localInputToIso(form.end, tz);
    if (!start_at || !end_at) {
      setNotice({ tone: "danger", text: "Isi tanggal & jam mulai dan berakhir." });
      return;
    }
    start(async () =>
      report(
        await saveExamSettings({
          title: form.title,
          description: form.description,
          start_at,
          end_at,
          timezone: tz,
          duration_minutes: form.duration_minutes,
          scoring_config: {
            category: form.category,
            regulation_year: form.regulation_year ? Number(form.regulation_year) : null,
            regulation_reference: form.regulation_reference,
            twk_min: form.twk_min,
            tiu_min: form.tiu_min,
            tkp_min: form.tkp_min,
            total_min: form.total_min === "" ? null : Number(form.total_min),
          },
        }),
      ),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Pengaturan Ujian</h1>
        <ExamStatusBadge status={exam.status} startAt={exam.start_at} endAt={exam.end_at} />
      </div>
      {notice ? (
        <Alert tone={notice.tone} className="whitespace-pre-line">
          {notice.text}
        </Alert>
      ) : null}

      {/* Status & kontrol */}
      <Card>
        <CardHeader>
          <CardTitle>Buka / tutup ujian</CardTitle>
          <CardDescription>
            Membuka ujian mengunci bank soal, kunci jawaban, bobot, jadwal, durasi, dan passing grade. Peserta dapat
            memulai hanya di antara waktu mulai dan berakhir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {exam.status === "draft" || exam.status === "scheduled" ? (
            <>
              {problems.length ? (
                <Alert tone="warning">
                  <p className="mb-1 font-medium">Belum siap dibuka:</p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </Alert>
              ) : (
                <Alert tone="success" className="flex items-center gap-2">
                  <CircleCheck className="size-4" /> Semua validasi terpenuhi. Ujian siap dibuka.
                </Alert>
              )}
              <Button disabled={pending || problems.length > 0} onClick={() => setOpenConfirm(true)}>
                <CirclePlay /> Buka ujian
              </Button>
            </>
          ) : null}

          {exam.status === "open" ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" onClick={() => setCloseOpen(true)}>
                <CircleStop /> Tutup ujian sekarang
              </Button>
              {sessionCount === 0 ? (
                <Button variant="outline" disabled={pending} onClick={() => start(async () => report(await unlockExam()))}>
                  <Undo2 /> Kembalikan ke draft
                </Button>
              ) : null}
            </div>
          ) : null}

          {exam.status === "closed" ? (
            <p className="text-sm text-muted-foreground">
              Ujian sudah ditutup. Ekspor hasil di menu Ekspor. Untuk menyelenggarakan ulang, hapus hasil di menu
              Pengaturan Akun.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Form */}
      <form onSubmit={onSave}>
        <fieldset disabled={locked || pending} className="space-y-4">
          {locked ? (
            <Alert tone="warning" className="flex items-center gap-2">
              <Lock className="size-4" /> Pengaturan terkunci karena ujian sudah dibuka.
            </Alert>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Identitas & jadwal</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama Try Out" htmlFor="title" className="sm:col-span-2">
                <Input id="title" value={form.title} onChange={set("title")} required />
              </Field>
              <Field label="Informasi singkat (tampil di halaman login)" htmlFor="desc" className="sm:col-span-2">
                <Textarea id="desc" value={form.description} onChange={set("description")} className="min-h-16" />
              </Field>
              <Field label="Zona waktu" htmlFor="tz">
                <Select id="tz" value={tz} onChange={(e) => setTz(e.target.value as TimezoneId)}>
                  {(Object.keys(TZ_LABEL) as TimezoneId[]).map((z) => (
                    <option key={z} value={z}>
                      {TZ_LABEL[z]} ({z})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Durasi normal (menit)" htmlFor="dur" hint="Default SKD: 100 menit.">
                <Input id="dur" type="number" min={1} max={600} value={form.duration_minutes} onChange={set("duration_minutes")} />
              </Field>
              <Field label={`Mulai (${TZ_LABEL[tz]})`} htmlFor="start">
                <Input id="start" type="datetime-local" value={form.start} onChange={set("start")} required />
              </Field>
              <Field label={`Berakhir (${TZ_LABEL[tz]})`} htmlFor="end" hint="Peserta yang mulai mendekati batas ini mendapat sisa waktu saja.">
                <Input id="end" type="datetime-local" value={form.end} onChange={set("end")} required />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Passing grade (ambang batas)</CardTitle>
              <CardDescription>
                Sesuaikan dengan regulasi yang berlaku untuk kategori seleksi acuan. Nilai awal hanya contoh dan wajib
                Anda verifikasi.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-4">
              <Field label="Min TWK (maks 150)" htmlFor="twk">
                <Input id="twk" type="number" min={0} max={150} value={form.twk_min} onChange={set("twk_min")} />
              </Field>
              <Field label="Min TIU (maks 175)" htmlFor="tiu">
                <Input id="tiu" type="number" min={0} max={175} value={form.tiu_min} onChange={set("tiu_min")} />
              </Field>
              <Field label="Min TKP (maks 225)" htmlFor="tkp">
                <Input id="tkp" type="number" min={0} max={225} value={form.tkp_min} onChange={set("tkp_min")} />
              </Field>
              <Field label="Min kumulatif (opsional)" htmlFor="tot">
                <Input id="tot" type="number" min={0} max={550} value={form.total_min} onChange={set("total_min")} />
              </Field>
              <Field label="Kategori seleksi" htmlFor="cat">
                <Input id="cat" value={form.category} onChange={set("category")} />
              </Field>
              <Field label="Tahun regulasi" htmlFor="year">
                <Input id="year" type="number" value={form.regulation_year} onChange={set("regulation_year")} />
              </Field>
              <Field label="Referensi regulasi" htmlFor="ref" className="sm:col-span-2">
                <Input id="ref" value={form.regulation_reference} onChange={set("regulation_reference")} />
              </Field>
            </CardContent>
          </Card>

          {!locked ? (
            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan…" : "Simpan pengaturan"}
              </Button>
            </div>
          ) : null}
        </fieldset>
      </form>

      <Modal open={openConfirm} onClose={() => setOpenConfirm(false)} title="Buka ujian?">
        <p className="text-sm">
          Setelah dibuka, bank soal dan pengaturan terkunci. Peserta dapat memulai sesuai jadwal dengan token aktif.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpenConfirm(false)}>
            Batal
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                setOpenConfirm(false);
                report(await openExam());
              })
            }
          >
            Ya, buka ujian
          </Button>
        </div>
      </Modal>

      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title="Tutup ujian?">
        <div className="space-y-3 text-sm">
          <p>
            Peserta tidak dapat memulai lagi. Semua sesi yang masih berjalan langsung difinalisasi dan dinilai dari
            jawaban yang sudah tersimpan. <b>Tindakan ini tidak dapat dibatalkan.</b>
          </p>
          <Field label='Ketik "TUTUP" untuk konfirmasi' htmlFor="close-confirm">
            <Input id="close-confirm" value={closeText} onChange={(e) => setCloseText(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCloseOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={pending || closeText.trim().toUpperCase() !== "TUTUP"}
              onClick={() =>
                start(async () => {
                  setCloseOpen(false);
                  report(await closeExam(closeText));
                })
              }
            >
              Tutup ujian
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
