"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import type { Question, Subtest } from "@/lib/types";
import { cn, SUBTEST_RANGES } from "@/lib/utils";
import { deleteQuestion } from "../actions";
import { QuestionEditor } from "./question-editor";

export function QuestionsClient({ questions, locked }: { questions: Question[]; locked: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | Subtest>("all");
  const [editing, setEditing] = useState<Question | { newNumber: number } | null>(null);
  const [toDelete, setToDelete] = useState<Question | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const active = questions.filter((q) => q.is_active);
  const byNumber = useMemo(() => {
    const m = new Map<number, Question>();
    for (const q of active) m.set(q.question_number, q);
    return m;
  }, [active]);
  const usedNumbers = new Set(active.map((q) => q.question_number));
  const firstFree = Array.from({ length: 110 }, (_, i) => i + 1).find((n) => !usedNumbers.has(n)) ?? 1;
  const list = filter === "all" ? questions : questions.filter((q) => q.subtest === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bank Soal</h1>
          <p className="text-sm text-muted-foreground">
            {active.length} / 110 soal aktif · TWK {active.filter((q) => q.subtest === "TWK").length}/30 · TIU{" "}
            {active.filter((q) => q.subtest === "TIU").length}/35 · TKP{" "}
            {active.filter((q) => q.subtest === "TKP").length}/45
          </p>
        </div>
        <Button onClick={() => setEditing({ newNumber: firstFree })} disabled={locked || usedNumbers.size >= 110}>
          <Plus /> Tambah soal
        </Button>
      </div>

      {locked ? (
        <Alert tone="warning" className="flex items-center gap-2">
          <Lock className="size-4" /> Ujian sudah dibuka. Bank soal, kunci jawaban, urutan, dan bobot terkunci.
        </Alert>
      ) : null}
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Peta nomor soal</CardTitle>
          <p className="text-xs text-muted-foreground">
            Klik nomor kosong untuk menambah soal pada nomor tersebut, atau nomor terisi untuk mengedit.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {SUBTEST_RANGES.map((g) => (
            <div key={g.subtest}>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">
                {g.subtest} ({g.from}–{g.to}) · {g.label}
              </p>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: g.to - g.from + 1 }, (_, i) => g.from + i).map((n) => {
                  const q = byNumber.get(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={locked && !q}
                      onClick={() => setEditing(q ?? { newNumber: n })}
                      className={cn(
                        "h-8 w-9 rounded border text-xs tabular-nums",
                        q ? "border-primary bg-primary text-white" : "border-dashed border-border bg-background text-muted-foreground",
                      )}
                      title={q ? `Soal ${n}` : `Nomor ${n} kosong`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            {(["all", "TWK", "TIU", "TKP"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  filter === f ? "border-primary bg-primary text-white" : "border-border",
                )}
              >
                {f === "all" ? "Semua" : f}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">No</th>
                  <th className="py-2 pr-3">Subtes</th>
                  <th className="py-2 pr-3">Pertanyaan</th>
                  <th className="py-2 pr-3">Kunci / bobot</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      Belum ada soal.
                    </td>
                  </tr>
                ) : (
                  list.map((q) => (
                    <tr key={q.id} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-3 tabular-nums">{q.question_number}</td>
                      <td className="py-2 pr-3">{q.subtest}</td>
                      <td className="max-w-md py-2 pr-3">
                        <p className="line-clamp-2">{q.question_text}</p>
                        {q.image_url ? <p className="text-xs text-muted-foreground">+ gambar</p> : null}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {q.subtest === "TKP" && q.tkp_scores
                          ? Object.entries(q.tkp_scores)
                              .map(([k, v]) => `${k}${v}`)
                              .join(" ")
                          : q.correct_answer}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge tone={q.is_active ? "success" : "muted"}>{q.is_active ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      <td className="py-2">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(q)} title={locked ? "Lihat" : "Edit"}>
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="sm" disabled={locked} onClick={() => setToDelete(q)} title="Hapus">
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
        </CardContent>
      </Card>

      {editing ? (
        <QuestionEditor
          key={"id" in editing ? editing.id : `new-${editing.newNumber}`}
          question={"id" in editing ? editing : null}
          defaultNumber={"id" in editing ? editing.question_number : editing.newNumber}
          usedNumbers={usedNumbers}
          locked={locked}
          onClose={() => setEditing(null)}
          onSaved={(msg, next) => {
            setNotice({ tone: "success", text: msg });
            router.refresh();
            if (next) {
              const n = Array.from({ length: 110 }, (_, i) => i + 1).find((x) => !usedNumbers.has(x) && x > next);
              setEditing(n ? { newNumber: n } : null);
            } else setEditing(null);
          }}
        />
      ) : null}

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Hapus soal?">
        <p className="text-sm">Soal nomor {toDelete?.question_number} akan dihapus permanen.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelete(null)}>
            Batal
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await deleteQuestion(toDelete!.id);
                setToDelete(null);
                setNotice(res.ok ? { tone: "success", text: res.message ?? "Dihapus." } : { tone: "danger", text: res.error });
                router.refresh();
              })
            }
          >
            Hapus
          </Button>
        </div>
      </Modal>
    </div>
  );
}
