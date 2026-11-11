"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { OPTION_KEYS, type OptionKey, type Question } from "@/lib/types";
import { cn, subtestOf } from "@/lib/utils";
import { saveQuestion } from "../actions";

const EMPTY_OPTIONS: Record<OptionKey, string> = { A: "", B: "", C: "", D: "", E: "" };
const DEFAULT_TKP: Record<OptionKey, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 };

export function QuestionEditor({
  question,
  defaultNumber,
  usedNumbers,
  locked,
  onClose,
  onSaved,
}: {
  question: Question | null;
  defaultNumber: number;
  usedNumbers: Set<number>;
  locked: boolean;
  onClose: () => void;
  onSaved: (message: string, nextAfter?: number) => void;
}) {
  const [number, setNumber] = useState(defaultNumber);
  const [text, setText] = useState(question?.question_text ?? "");
  const [imageUrl, setImageUrl] = useState(question?.image_url ?? "");
  const [options, setOptions] = useState<Record<OptionKey, string>>(question?.options ?? EMPTY_OPTIONS);
  const [correct, setCorrect] = useState<OptionKey | null>(question?.correct_answer ?? null);
  const [tkp, setTkp] = useState<Record<OptionKey, number>>(question?.tkp_scores ?? DEFAULT_TKP);
  const [isActive, setIsActive] = useState(question?.is_active ?? true);
  const [imgState, setImgState] = useState<"idle" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const subtest = subtestOf(number);
  const isTkp = subtest === "TKP";
  const imageValid = !imageUrl || /^https:\/\/\S+$/i.test(imageUrl.trim());

  function submit(addNext: boolean) {
    setError(null);
    start(async () => {
      const res = await saveQuestion({
        id: question?.id,
        question_number: number,
        question_text: text,
        image_url: imageUrl.trim(),
        options,
        correct_answer: isTkp ? null : correct,
        tkp_scores: isTkp ? tkp : null,
        is_active: isActive,
      });
      if (res.ok) onSaved(`Soal nomor ${number} disimpan.`, addNext ? number : undefined);
      else setError(res.error);
    });
  }

  return (
    <Modal open onClose={onClose} title={question ? `Soal nomor ${question.question_number}` : "Tambah soal"} wide>
      <fieldset disabled={locked} className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nomor soal" htmlFor="q-num">
              <Select id="q-num" value={number} onChange={(e) => setNumber(Number(e.target.value))}>
                {Array.from({ length: 110 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n} disabled={usedNumbers.has(n) && n !== question?.question_number}>
                    {n} · {subtestOf(n)}
                    {usedNumbers.has(n) && n !== question?.question_number ? " (terisi)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subtes" htmlFor="q-sub" hint="Ditentukan dari nomor soal.">
              <Input id="q-sub" value={subtest} readOnly className="bg-muted" />
            </Field>
          </div>

          <Field label="Pertanyaan" htmlFor="q-text">
            <Textarea id="q-text" value={text} onChange={(e) => setText(e.target.value)} className="min-h-32" />
          </Field>

          <Field
            label="URL gambar (opsional)"
            htmlFor="q-img"
            hint="HTTPS, dapat diakses publik, sudah dikompresi (ideal ≤ 200 KB, WebP). Aplikasi tidak mengompresi gambar."
          >
            <Input
              id="q-img"
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                setImgState("idle");
              }}
              placeholder="https://…"
            />
            {!imageValid ? <p className="text-xs text-destructive">URL harus diawali https://</p> : null}
          </Field>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Pilihan jawaban {isTkp ? "dan bobot (1–5)" : "— pilih kunci jawaban"}
            </p>
            {OPTION_KEYS.map((k) => (
              <div key={k} className="flex items-start gap-2">
                {isTkp ? (
                  <Select
                    aria-label={`Bobot ${k}`}
                    value={tkp[k]}
                    onChange={(e) => setTkp({ ...tkp, [k]: Number(e.target.value) })}
                    className="w-16 shrink-0"
                  >
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <label
                    className={cn(
                      "flex h-10 w-16 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border text-sm",
                      correct === k ? "border-success bg-success/10 font-semibold text-success" : "border-border",
                    )}
                  >
                    <input
                      type="radio"
                      name="correct"
                      className="sr-only"
                      checked={correct === k}
                      onChange={() => setCorrect(k)}
                    />
                    {correct === k ? "✓ " : ""}
                    {k}
                  </label>
                )}
                <Textarea
                  aria-label={`Pilihan ${k}`}
                  value={options[k]}
                  onChange={(e) => setOptions({ ...options, [k]: e.target.value })}
                  className="min-h-10 py-2"
                  rows={1}
                  placeholder={`Pilihan ${k}`}
                />
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4" />
            Soal aktif (dipakai dalam ujian)
          </label>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Preview (tampilan peserta)</p>
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="mb-2 text-xs font-semibold text-primary">
              {subtest} · Soal {number}
            </p>
            <div className="question-text text-sm">{text || <span className="text-muted-foreground">Pertanyaan…</span>}</div>
            {imageUrl && imageValid ? (
              <div className="mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={imageUrl}
                  src={imageUrl.trim()}
                  alt="Preview gambar soal"
                  className={cn("max-h-72 w-auto max-w-full rounded border border-border", imgState === "error" && "hidden")}
                  onLoad={() => setImgState("ok")}
                  onError={() => setImgState("error")}
                />
                {imgState === "error" ? (
                  <Alert tone="danger">Gambar gagal dimuat. Pastikan URL benar, publik, dan mengarah langsung ke file gambar.</Alert>
                ) : null}
                {imgState === "ok" ? <p className="mt-1 text-xs text-success">Gambar berhasil dimuat.</p> : null}
              </div>
            ) : null}
            <div className="mt-3 space-y-1.5">
              {OPTION_KEYS.map((k) => (
                <div key={k} className="flex gap-2 rounded border border-border p-2 text-sm">
                  <span className="font-semibold">{k}.</span>
                  <span className="question-text flex-1">{options[k]}</span>
                  <span className="text-xs text-muted-foreground">
                    {isTkp ? `skor ${tkp[k]}` : correct === k ? "kunci" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          {locked ? "Tutup" : "Batal"}
        </Button>
        {!locked ? (
          <>
            {!question ? (
              <Button variant="secondary" disabled={pending || !imageValid} onClick={() => submit(true)}>
                Simpan &amp; tambah berikutnya
              </Button>
            ) : null}
            <Button disabled={pending || !imageValid} onClick={() => submit(false)}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
