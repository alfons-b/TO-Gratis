"use client";

import { useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import { ParticipantStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { exportParticipantPdf } from "@/lib/export";
import type { Exam, ParticipantRow } from "@/lib/types";
import { formatDuration, formatDateTime, passedLabel } from "@/lib/utils";
import { getExportData } from "../actions";

type Sort = "no" | "score_desc" | "score_asc" | "name";
const PAGE_SIZE = 50;

export function ResultsClient({ rows, exam }: { rows: ParticipantRow[]; exam: Exam }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("no");
  const [onlyDone, setOnlyDone] = useState(true);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<ParticipantRow | null>(null);
  const [busy, setBusy] = useState(false);
  const tz = exam.timezone;

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const r = rows.filter(
      (p) =>
        (!onlyDone || p.exam_status === "submitted" || p.exam_status === "timed_out") &&
        (!t || p.full_name.toLowerCase().includes(t) || p.username.includes(t)),
    );
    const sorted = [...r];
    if (sort === "score_desc") sorted.sort((a, b) => (b.total_score ?? -1) - (a.total_score ?? -1));
    if (sort === "score_asc") sorted.sort((a, b) => (a.total_score ?? 9999) - (b.total_score ?? 9999));
    if (sort === "name") sorted.sort((a, b) => a.full_name.localeCompare(b.full_name, "id"));
    return sorted;
  }, [rows, q, sort, onlyDone]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const view = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  async function pdfFor(p: ParticipantRow) {
    setBusy(true);
    try {
      await exportParticipantPdf(await getExportData(`pdf_participant:${p.username}`), p.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Hasil</h1>
      <Card>
        <CardHeader className="flex flex-wrap items-end gap-3 space-y-0">
          <Input
            placeholder="Cari nama atau username…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            className="max-w-xs"
          />
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-48">
            <option value="no">Urut nomor peserta</option>
            <option value="score_desc">Nilai tertinggi</option>
            <option value="score_asc">Nilai terendah</option>
            <option value="name">Nama A–Z</option>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyDone}
              onChange={(e) => {
                setOnlyDone(e.target.checked);
                setPage(0);
              }}
            />
            Hanya yang sudah selesai
          </label>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">No</th>
                  <th className="py-2 pr-3">Nama</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">TWK</th>
                  <th className="py-2 pr-3 text-right">TIU</th>
                  <th className="py-2 pr-3 text-right">TKP</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  <th className="py-2 pr-3">Passing grade</th>
                  <th className="py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {view.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      Belum ada hasil.
                    </td>
                  </tr>
                ) : (
                  view.map((p) => {
                    const finished = p.exam_status === "submitted" || p.exam_status === "timed_out";
                    return (
                      <tr key={p.id} className="border-b border-border/60">
                        <td className="py-2 pr-3 tabular-nums">{p.participant_no ?? "-"}</td>
                        <td className="py-2 pr-3">
                          <p className="font-medium">{p.full_name}</p>
                          <p className="text-xs text-muted-foreground">@{p.username}</p>
                        </td>
                        <td className="py-2 pr-3">
                          <ParticipantStatusBadge status={p.exam_status} />
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.twk_score ?? "-"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.tiu_score ?? "-"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.tkp_score ?? "-"}</td>
                        <td className="py-2 pr-3 text-right font-semibold tabular-nums">{p.total_score ?? "-"}</td>
                        <td className="py-2 pr-3">
                          {finished ? (
                            <Badge tone={p.passed ? "success" : "danger"}>{p.passed ? "Memenuhi" : "Tidak memenuhi"}</Badge>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setDetail(p)}>
                            Detail
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {pages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Halaman {page + 1} dari {pages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Sebelumnya
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
                  Berikutnya
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.full_name}>
        {detail ? (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Username</dt>
              <dd>@{detail.username}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <ParticipantStatusBadge status={detail.exam_status} />
              </dd>
              <dt className="text-muted-foreground">Mulai</dt>
              <dd>{formatDateTime(detail.started_at, tz)}</dd>
              <dt className="text-muted-foreground">Selesai</dt>
              <dd>{formatDateTime(detail.submitted_at, tz)}</dd>
              <dt className="text-muted-foreground">Durasi</dt>
              <dd>{formatDuration(detail.started_at, detail.submitted_at)}</dd>
              <dt className="text-muted-foreground">TWK / TIU / TKP</dt>
              <dd>
                {detail.twk_score ?? "-"} / {detail.tiu_score ?? "-"} / {detail.tkp_score ?? "-"}
              </dd>
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-semibold">{detail.total_score ?? "-"}</dd>
              <dt className="text-muted-foreground">Benar / Salah</dt>
              <dd>
                {detail.correct_count ?? "-"} / {detail.incorrect_count ?? "-"} (TWK+TIU)
              </dd>
              <dt className="text-muted-foreground">TKP dijawab</dt>
              <dd>{detail.tkp_answered_count ?? "-"}</dd>
              <dt className="text-muted-foreground">Kosong</dt>
              <dd>{detail.unanswered_count ?? "-"}</dd>
              <dt className="text-muted-foreground">Passing grade</dt>
              <dd>{detail.session_id ? passedLabel(detail.passed) : "-"}</dd>
            </dl>
            {detail.exam_status === "submitted" || detail.exam_status === "timed_out" ? (
              <Button variant="outline" disabled={busy} onClick={() => void pdfFor(detail)}>
                <FileDown /> {busy ? "Membuat PDF…" : "Unduh laporan PDF"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
