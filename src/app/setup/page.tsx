import { Brand } from "@/components/brand";
import { Card, CardContent } from "@/components/ui/card";
import { createServiceClient } from "@/lib/supabase/admin";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  let adminExists = true;
  let configError: string | null = null;
  try {
    const svc = createServiceClient();
    const { count, error } = await svc
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (error) throw error;
    adminExists = (count ?? 0) > 0;
  } catch (e) {
    configError = e instanceof Error ? e.message : "Konfigurasi server belum lengkap.";
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex justify-center">
        <Brand />
      </div>
      <Card>
        <CardContent className="space-y-4 pt-5">
          <h1 className="text-xl font-semibold">Setup administrator</h1>
          {configError ? (
            <p className="text-sm text-destructive">
              {configError} Periksa environment variables dan pastikan migration SQL sudah dijalankan.
            </p>
          ) : adminExists ? (
            <p className="text-sm text-muted-foreground">
              Akun administrator sudah ada. Halaman ini tidak dapat digunakan lagi.
            </p>
          ) : !process.env.SETUP_SECRET ? (
            <p className="text-sm text-destructive">
              Environment variable <code>SETUP_SECRET</code> belum diisi di server.
            </p>
          ) : (
            <SetupForm />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
