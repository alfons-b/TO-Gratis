import Link from "next/link";
import { redirect } from "next/navigation";
import { ParticipantHeader } from "@/components/participant-header";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParticipant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Exam } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { TokenForm } from "./token-form";

export const dynamic = "force-dynamic";

export default async function PesertaPage() {
  const profile = await requireParticipant();
  const supabase = await createClient();

  const { data: examRow } = await supabase
    .from("exams")
    .select("id,title,description,start_at,end_at,timezone,duration_minutes,status")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const exam = examRow as Pick<
    Exam,
    "id" | "title" | "description" | "start_at" | "end_at" | "timezone" | "duration_minutes" | "status"
  > | null;
  if (!exam) redirect("/");

  const { data: session } = await supabase
    .from("exam_sessions")
    .select("id,status,deadline_at")
    .eq("exam_id", exam.id)
    .eq("user_id", profile.id)
    .maybeSingle();

  // Sesi yang melewati batas waktu: finalisasi di server lalu tampilkan hasil
  if (session && session.status === "in_progress" && new Date(session.deadline_at) <= new Date()) {
    await supabase.rpc("get_my_result");
    redirect("/peserta/hasil");
  }

  const { data: access } = await supabase
    .from("exam_access")
    .select("verified_at")
    .eq("exam_id", exam.id)
    .eq("user_id", profile.id)
    .maybeSingle();

  const now = Date.now();
  const startMs = exam.start_at ? new Date(exam.start_at).getTime() : null;
  const endMs = exam.end_at ? new Date(exam.end_at).getTime() : null;
  const isOpen = exam.status === "open" && startMs !== null && endMs !== null && now >= startMs && now < endMs;
  const isEnded = exam.status === "closed" || (endMs !== null && now >= endMs);

  let statusBadge: React.ReactNode;
  let body: React.ReactNode;

  if (session?.status === "in_progress") {
    statusBadge = <Badge tone="warning">Sedang mengerjakan</Badge>;
    body = (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Ujian Anda sedang berlangsung. Waktu terus berjalan berdasarkan waktu server.
        </p>
        <Link href="/ujian" className={buttonVariants({ size: "lg", className: "w-full" })}>
          Lanjutkan ujian
        </Link>
      </div>
    );
  } else if (session) {
    statusBadge = <Badge tone="success">Selesai</Badge>;
    body = (
      <Link href="/peserta/hasil" className={buttonVariants({ size: "lg", className: "w-full" })}>
        Lihat hasil
      </Link>
    );
  } else if (isEnded) {
    statusBadge = <Badge tone="muted">Tidak mengikuti</Badge>;
    body = <p className="text-sm text-muted-foreground">Periode ujian telah berakhir.</p>;
  } else if (!isOpen) {
    statusBadge = <Badge tone="info">Belum dibuka</Badge>;
    body = (
      <p className="text-sm text-muted-foreground">
        Ujian dapat dimulai pada {formatDateTime(exam.start_at, exam.timezone)}. Muat ulang halaman ini saat
        ujian sudah dibuka.
      </p>
    );
  } else if (access) {
    statusBadge = <Badge tone="info">Belum memulai</Badge>;
    body = (
      <Link href="/peserta/instruksi" className={buttonVariants({ size: "lg", className: "w-full" })}>
        Lanjut ke instruksi
      </Link>
    );
  } else {
    statusBadge = <Badge tone="info">Belum memulai</Badge>;
    body = <TokenForm />;
  }

  return (
    <>
      <ParticipantHeader profile={profile} />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{exam.title}</CardTitle>
              {statusBadge}
            </div>
            {exam.description ? <p className="text-sm text-muted-foreground">{exam.description}</p> : null}
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Peserta</dt>
              <dd>
                {profile.full_name} (@{profile.username})
              </dd>
              <dt className="text-muted-foreground">Dibuka</dt>
              <dd>{formatDateTime(exam.start_at, exam.timezone)}</dd>
              <dt className="text-muted-foreground">Ditutup</dt>
              <dd>{formatDateTime(exam.end_at, exam.timezone)}</dd>
              <dt className="text-muted-foreground">Durasi</dt>
              <dd>{exam.duration_minutes} menit · 110 soal (TWK 30, TIU 35, TKP 45)</dd>
            </dl>
            {body}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
