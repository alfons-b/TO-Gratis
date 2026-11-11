"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, LockOpen } from "lucide-react";
import { ExamStatusBadge, ParticipantStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DashboardStats, Exam, ParticipantExamStatus, ParticipantRow } from "@/lib/types";
import { cn, EXAM_STATUS_LABEL, formatDateTime, formatTime } from "@/lib/utils";
import { getDashboard, releaseDevice } from "./actions";

const REFRESH_MS = 30_000;
const FILTERS: ("all" | ParticipantExamStatus)[] = [
  "all",
  "in_progress",
  "not_started",
  "submitted",
  "timed_out",
  "not_participating",
];

export function DashboardClient({
  initial,
  exam,
}: {
  initial: { stats: DashboardStats; participants: ParticipantRow[] };
  exam: Exam;
}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("in_progress");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getDashboard());
      setUpdatedAt(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const s = data.stats;
  const tz = exam.timezone;
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.participants.filter(
      (p) =>
        (filter === "all" || p.exam_status === filter) &&
        (!term || p.full_name.toLowerCase().includes(term) || p.username.includes(term)),
    );
  }, [data.participants, filter, q]);

  const cards: [string, React.ReactNode][] = [
    ["Total peserta", s.total_participants],
    ["Akun aktif", s.active_accounts],
    ["Belum memulai", s.not_started],
    ["Sedang mengerjakan", s.in_progress],
    ["Sudah selesai", s.finished],
    ["Tidak mengikuti", s.not_participating],
    ["Total soal", `${s.total_questions} / 110`],
    ["Rata-rata nilai", s.avg_total ?? "-"],
    ["Nilai tertinggi", s.max_total ?? "-"],
    ["Nilai terendah", s.min_total ?? "-"],
    ["Rata-rata TWK", s.avg_twk ?? "-"],
    ["Rata-rata TIU", s.avg_tiu ?? "-"],
    ["Rata-rata TKP", s.avg_tkp ?? "-"],
    ["Memenuhi ambang batas", s.passed],
  ];

  async function onRelease(sessionId: string) {
    if (!confirm("Lepaskan kunci perangkat peserta ini? Peserta dapat melanjutkan di perangkat lain.")) return;
    const res = await releaseDevice(sessionId);
    setMsg(res.ok ? (res.message ?? "OK") : res.error);
    void refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{exam.title}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(exam.start_at, tz)} – {formatDateTime(exam.end_at, tz)} · {exam.duration_minutes} menit
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExamStatusBadge status={exam.status} startAt={exam.start_at} endAt={exam.end_at} />
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={cn(loading && "animate-spin")} /> Muat ulang
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Pemantauan ujian</CardTitle>
            <p className="text-xs text-muted-foreground">
              Diperbarui otomatis tiap 30 detik · terakhir {updatedAt.toLocaleTimeString("id-ID")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {FILTERS.map((f) => {
              const count =
                f === "all" ? data.participants.length : data.participants.filter((p) => p.exam_status === f).length;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    filter === f ? "border-primary bg-primary text-white" : "border-border bg-background",
                  )}
                >
                  {f === "all" ? "Semua" : EXAM_STATUS_LABEL[f]} ({count})
                </button>
              );
            })}
          </div>
          <Input
            placeholder="Cari nama atau username…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-2 max-w-sm"
          />
        </CardHeader>
        <CardContent>
          {msg ? <p className="mb-3 text-sm">{msg}</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">No</th>
                  <th className="py-2 pr-3">Nama</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Mulai</th>
                  <th className="py-2 pr-3">Batas / Selesai</th>
                  <th className="py-2 pr-3 text-right">Nilai</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">
                      Tidak ada data.
                    </td>
                  </tr>
                ) : (
                  rows.map((p) => {
                    const stale =
                      p.exam_status === "in_progress" &&
                      (!p.last_heartbeat_at || Date.now() - new Date(p.last_heartbeat_at).getTime() > 90_000);
                    return (
                      <tr key={p.id} className="border-b border-border/60">
                        <td className="py-2 pr-3 tabular-nums">{p.participant_no ?? "-"}</td>
                        <td className="py-2 pr-3">
                          <p className="font-medium">{p.full_name}</p>
                          <p className="text-xs text-muted-foreground">@{p.username}</p>
                        </td>
                        <td className="py-2 pr-3">
                          <ParticipantStatusBadge status={p.exam_status} />
                          {stale ? <p className="mt-1 text-xs text-warning">tidak aktif &gt; 90 dtk</p> : null}
                        </td>
                        <td className="py-2 pr-3">{formatTime(p.started_at, tz)}</td>
                        <td className="py-2 pr-3">
                          {formatTime(p.exam_status === "in_progress" ? p.deadline_at : p.submitted_at, tz)}
                        </td>
                        <td className="py-2 pr-3 text-right font-semibold tabular-nums">{p.total_score ?? "-"}</td>
                        <td className="py-2 text-right">
                          {p.exam_status === "in_progress" && p.session_id ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void onRelease(p.session_id!)}
                              title="Lepas kunci perangkat"
                            >
                              <LockOpen /> Lepas perangkat
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
