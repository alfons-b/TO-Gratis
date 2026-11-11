import { redirect } from "next/navigation";
import { ParticipantHeader } from "@/components/participant-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParticipant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Exam } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { StartButton } from "./start-button";

export const dynamic = "force-dynamic";

export default async function InstruksiPage() {
  const profile = await requireParticipant();
  const supabase = await createClient();

  const { data: examRow } = await supabase
    .from("exams")
    .select("id,title,end_at,timezone,duration_minutes,status")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const exam = examRow as Pick<Exam, "id" | "title" | "end_at" | "timezone" | "duration_minutes" | "status"> | null;
  if (!exam) redirect("/peserta");

  const { data: session } = await supabase
    .from("exam_sessions")
    .select("id")
    .eq("exam_id", exam.id)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (session) redirect("/ujian");

  const { data: access } = await supabase
    .from("exam_access")
    .select("verified_at")
    .eq("exam_id", exam.id)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!access) redirect("/peserta");

  const endMs = exam.end_at ? new Date(exam.end_at).getTime() : 0;
  const minutesLeft = Math.max(0, Math.floor((endMs - Date.now()) / 60000));
  const effective = Math.min(exam.duration_minutes, minutesLeft);

  return (
    <>
      <ParticipantHeader profile={profile} />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Instruksi ujian</CardTitle>
            <p className="text-sm text-muted-foreground">{exam.title}</p>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Ujian terdiri dari <b>110 soal</b>: TWK nomor 1–30, TIU nomor 31–65, dan TKP nomor 66–110.
              </li>
              <li>
                Durasi normal <b>{exam.duration_minutes} menit</b>, tetapi tidak melewati batas penutupan ujian (
                {formatDateTime(exam.end_at, exam.timezone)}). Jika mulai sekarang, waktu Anda sekitar{" "}
                <b>{effective} menit</b>.
              </li>
              <li>
                Waktu dihitung oleh server sejak Anda menekan <b>Mulai ujian</b> dan tetap berjalan walaupun
                halaman di-refresh, browser ditutup, atau internet terputus.
              </li>
              <li>
                Anda hanya memiliki <b>satu kesempatan</b>. Setelah dimulai, kesempatan tidak dapat diulang.
              </li>
              <li>Anda boleh berpindah ke nomor mana pun dan mengubah jawaban sebelum mengumpulkan.</li>
              <li>
                Setiap jawaban <b>tersimpan otomatis</b>. Perhatikan indikator <i>Tersimpan</i> di bagian atas.
                Jika internet terputus, jawaban disimpan sementara di perangkat dan dikirim otomatis saat koneksi
                kembali. Jawaban yang belum terkirim dapat hilang jika data browser dihapus sebelum koneksi pulih —
                jangan menutup browser saat status <i>Menunggu koneksi</i>.
              </li>
              <li>
                Ujian hanya dapat dikerjakan di <b>satu perangkat</b> dalam satu waktu. Jika perangkat Anda
                bermasalah, tunggu sekitar 2 menit lalu login di perangkat lain untuk melanjutkan.
              </li>
              <li>
                Penilaian: TWK dan TIU benar = 5, salah/kosong = 0. TKP bernilai 1–5 sesuai pilihan, kosong = 0.
              </li>
              <li>Saat waktu habis, jawaban yang sudah tersimpan dikumpulkan otomatis.</li>
            </ol>
            <StartButton />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
