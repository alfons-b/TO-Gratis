import { redirect } from "next/navigation";
import { ParticipantHeader } from "@/components/participant-header";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParticipant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MyResult } from "@/lib/types";
import { formatDate, formatDuration, formatTime, passedLabel } from "@/lib/utils";
import { ScoreChart } from "./score-chart";

export const dynamic = "force-dynamic";

export default async function HasilPage() {
  const profile = await requireParticipant();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_result");
  const r = data as MyResult | null;
  if (!r) redirect("/peserta");
  if (r.status === "in_progress") redirect("/ujian");

  const cfg = r.scoring_config;
  const rows: [string, React.ReactNode][] = [
    ["Nama peserta", r.full_name],
    ["Username", r.username],
    ["Try Out", r.exam_title],
    ["Tanggal pengerjaan", formatDate(r.started_at, r.timezone)],
    ["Waktu mulai", formatTime(r.started_at, r.timezone)],
    ["Waktu selesai", formatTime(r.submitted_at, r.timezone)],
    ["Durasi pengerjaan", formatDuration(r.started_at, r.submitted_at)],
    [
      "Cara selesai",
      r.finalize_reason === "submit"
        ? "Dikumpulkan peserta"
        : r.finalize_reason === "closed"
          ? "Ujian ditutup panitia"
          : "Waktu habis (otomatis)",
    ],
  ];

  const subtests = [
    { name: "TWK", score: r.twk_score ?? 0, max: 150, min: cfg.twk_min },
    { name: "TIU", score: r.tiu_score ?? 0, max: 175, min: cfg.tiu_min },
    { name: "TKP", score: r.tkp_score ?? 0, max: 225, min: cfg.tkp_min },
  ];

  return (
    <>
      <ParticipantHeader profile={profile} />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Hasil ujian</CardTitle>
              <Badge tone={r.passed ? "success" : "danger"}>{passedLabel(r.passed)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Nilai total</p>
              <p className="text-5xl font-bold tabular-nums">{r.total_score ?? 0}</p>
              <p className="text-sm text-muted-foreground">dari 550</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {subtests.map((s) => (
                <div key={s.name} className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xs font-medium text-muted-foreground">{s.name}</p>
                  <p className="text-2xl font-semibold tabular-nums">{s.score}</p>
                  <p className="text-xs text-muted-foreground">
                    maks {s.max} · min {s.min}
                  </p>
                  <p className={s.score >= s.min ? "text-xs text-success" : "text-xs text-destructive"}>
                    {s.score >= s.min ? "Memenuhi" : "Belum memenuhi"}
                  </p>
                </div>
              ))}
            </div>

            <ScoreChart data={subtests} />

            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              <Stat label="Benar (TWK+TIU)" value={r.correct_count} />
              <Stat label="Salah (TWK+TIU)" value={r.incorrect_count} />
              <Stat label="TKP dijawab" value={r.tkp_answered_count} />
              <Stat label="Kosong" value={r.unanswered_count} />
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>

            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Ambang batas simulasi: TWK {cfg.twk_min}, TIU {cfg.tiu_min}, TKP {cfg.tkp_min}
              {cfg.total_min ? `, total ${cfg.total_min}` : ""} ({cfg.category}
              {cfg.regulation_year ? `, ${cfg.regulation_year}` : ""}). Memenuhi ambang batas dalam simulasi
              tidak berarti lulus seleksi CPNS yang sebenarnya. Untuk TKP, setiap pilihan memiliki skor 1–5
              sehingga tidak dihitung sebagai benar/salah.
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <p className="text-xl font-semibold tabular-nums">{value ?? 0}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
