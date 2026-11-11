import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TimezoneId } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

interface PublicExamInfo {
  title: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  timezone: TimezoneId;
  duration_minutes: number;
  status: string;
  question_count: number;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ nonaktif?: string }>;
}) {
  const sp = await searchParams;
  const profile = await getCurrentProfile();
  if (profile?.is_active) redirect(profile.role === "admin" ? "/admin" : "/peserta");

  const supabase = await createClient();
  const { data } = await supabase.rpc("public_exam_info");
  const info = data as PublicExamInfo | null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex justify-center">
        <Brand />
      </div>
      <Card>
        <CardContent className="space-y-5 pt-5">
          <div>
            <h1 className="text-xl font-semibold">Masuk</h1>
            <p className="text-sm text-muted-foreground">Gunakan username dan password dari panitia.</p>
          </div>
          {sp.nonaktif || (profile && !profile.is_active) ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              Akun Anda tidak aktif. Hubungi panitia.
            </p>
          ) : null}
          <LoginForm />
        </CardContent>
      </Card>
      {info ? (
        <section className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="font-medium">{info.title}</p>
          {info.description ? <p className="mt-1 text-muted-foreground">{info.description}</p> : null}
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
            <dt>Dibuka</dt>
            <dd className="text-foreground">{formatDateTime(info.start_at, info.timezone)}</dd>
            <dt>Ditutup</dt>
            <dd className="text-foreground">{formatDateTime(info.end_at, info.timezone)}</dd>
            <dt>Durasi</dt>
            <dd className="text-foreground">{info.duration_minutes} menit · 110 soal</dd>
          </dl>
        </section>
      ) : null}
    </main>
  );
}
