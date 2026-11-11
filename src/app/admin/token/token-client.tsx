"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { TimezoneId } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { regenerateToken, setTokenActive } from "../actions";

export function TokenClient({
  status,
  timezone,
}: {
  status: { exists: boolean; is_active?: boolean; created_at?: string; updated_at?: string };
  timezone: TimezoneId;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [custom, setCustom] = useState("");
  const [shown, setShown] = useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  function regen() {
    start(async () => {
      setConfirmRegen(false);
      const res = await regenerateToken(custom || undefined);
      if (res.ok) {
        setShown(res.data!.token);
        setCustom("");
        setNotice(null);
        router.refresh();
      } else setNotice({ tone: "danger", text: res.error });
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Token Ujian</h1>
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Status token</CardTitle>
          <CardDescription>
            Satu token dipakai bersama oleh seluruh peserta. Token disimpan sebagai hash, sehingga hanya ditampilkan
            sekali saat dibuat. Mengganti token tidak membatalkan sesi yang sudah berjalan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.exists ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge tone={status.is_active ? "success" : "danger"}>{status.is_active ? "Aktif" : "Nonaktif"}</Badge>
              <span className="text-muted-foreground">Dibuat {formatDateTime(status.created_at, timezone)}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada token.</p>
          )}

          {shown ? (
            <Alert tone="success">
              <p className="text-xs">Token baru — catat sekarang, tidak akan ditampilkan lagi:</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="font-mono text-3xl font-bold tracking-[0.3em] text-foreground">{shown}</span>
                <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(shown)}>
                  <Copy /> Salin
                </Button>
              </div>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {status.exists ? (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await setTokenActive(!status.is_active);
                    setNotice(res.ok ? { tone: "success", text: res.message ?? "OK" } : { tone: "danger", text: res.error });
                    router.refresh();
                  })
                }
              >
                {status.is_active ? "Nonaktifkan token" : "Aktifkan token"}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{status.exists ? "Ganti token" : "Buat token"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field
            label="Token kustom (opsional)"
            htmlFor="custom"
            hint="Kosongkan untuk dibuatkan token acak 6 karakter. Huruf/angka, 4–32 karakter, tidak peka huruf besar/kecil."
          >
            <Input
              id="custom"
              value={custom}
              onChange={(e) => setCustom(e.target.value.toUpperCase())}
              className="font-mono"
              maxLength={32}
            />
          </Field>
          <Button disabled={pending} onClick={() => (status.exists ? setConfirmRegen(true) : regen())}>
            <RefreshCw /> {status.exists ? "Ganti token" : "Buat token"}
          </Button>
        </CardContent>
      </Card>

      <Modal open={confirmRegen} onClose={() => setConfirmRegen(false)} title="Ganti token?">
        <p className="text-sm">
          Token lama langsung tidak berlaku. Peserta yang sudah memasukkan token atau sedang mengerjakan tidak
          terpengaruh.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmRegen(false)}>
            Batal
          </Button>
          <Button onClick={regen} disabled={pending}>
            Ganti token
          </Button>
        </div>
      </Modal>
    </div>
  );
}
