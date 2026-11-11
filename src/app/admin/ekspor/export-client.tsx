"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  exportAllParticipantPdfs,
  exportParticipantsXlsx,
  exportRecapPdf,
  exportResultsXlsx,
  exportStatsPdf,
} from "@/lib/export";
import { getExportData } from "../actions";

const ITEMS = [
  {
    kind: "xlsx_participants",
    title: "Data peserta (Excel)",
    desc: "Nomor, nama, username, status akun, status pengerjaan. Tanpa password.",
    icon: FileSpreadsheet,
    run: exportParticipantsXlsx,
  },
  {
    kind: "xlsx_results",
    title: "Hasil ujian (Excel)",
    desc: "Nilai TWK/TIU/TKP, total, benar/salah/kosong, passing grade, waktu, durasi + lembar ringkasan.",
    icon: FileSpreadsheet,
    run: exportResultsXlsx,
  },
  {
    kind: "pdf_recap",
    title: "Rekap keseluruhan (PDF)",
    desc: "Tabel hasil semua peserta beserta ringkasan statistik.",
    icon: FileText,
    run: exportRecapPdf,
  },
  {
    kind: "pdf_stats",
    title: "Ringkasan statistik (PDF)",
    desc: "Statistik keseluruhan kegiatan.",
    icon: FileText,
    run: exportStatsPdf,
  },
  {
    kind: "pdf_per_participant",
    title: "Laporan per peserta (PDF)",
    desc: "Satu halaman per peserta yang telah selesai, dalam satu file. Laporan individu juga tersedia di menu Hasil.",
    icon: FileText,
    run: exportAllParticipantPdfs,
  },
] as const;

export function ExportClient() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(item: (typeof ITEMS)[number]) {
    setBusy(item.kind);
    setError(null);
    try {
      const data = await getExportData(item.kind);
      const res = await item.run(data);
      if (res === false) setError("Belum ada peserta yang menyelesaikan ujian.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengekspor.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Ekspor</h1>
      <p className="text-sm text-muted-foreground">
        File dibuat di browser Anda dari data terbaru. Setiap ekspor tercatat di audit log.
      </p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map((it) => (
          <Card key={it.kind}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <it.icon className="size-4 text-primary" /> {it.title}
              </CardTitle>
              <CardDescription>{it.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" disabled={busy !== null} onClick={() => void run(it)}>
                {busy === it.kind ? "Menyiapkan…" : "Unduh"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
