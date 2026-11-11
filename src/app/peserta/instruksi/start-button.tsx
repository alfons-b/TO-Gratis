"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { getDeviceId } from "@/lib/device";
import { errorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

export function StartButton() {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await createClient().rpc("start_exam_session", {
      p_device_id: getDeviceId(),
    });
    const res = data as { ok: boolean; error?: string } | null;
    if (err || !res?.ok) {
      setLoading(false);
      setConfirm(false);
      setError(errorMessage(res?.error));
      return;
    }
    router.replace("/ujian");
  }

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-0.5 size-5 accent-[var(--color-primary)]"
        />
        <span>Saya telah membaca dan memahami instruksi ujian.</span>
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button size="lg" className="w-full" disabled={!agree || loading} onClick={() => setConfirm(true)}>
        <Play /> Mulai ujian
      </Button>
      <Modal open={confirm} onClose={() => !loading && setConfirm(false)} title="Mulai ujian sekarang?">
        <p className="text-sm text-muted-foreground">
          Timer akan langsung berjalan dan kesempatan Anda terpakai. Pastikan koneksi internet stabil.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirm(false)} disabled={loading}>
            Batal
          </Button>
          <Button onClick={start} disabled={loading}>
            {loading ? "Memulai…" : "Ya, mulai"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
