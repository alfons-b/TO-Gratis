"use client";

import type { DashboardStats, Exam, ParticipantRow } from "./types";
import {
  APP_NAME,
  durationMinutes,
  EXAM_STATUS_LABEL,
  formatDate,
  formatDateTime,
  formatTime,
  passedLabel,
} from "./utils";

export interface ExportData {
  participants: ParticipantRow[];
  stats: DashboardStats;
  exam: Exam;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

async function workbook() {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = APP_NAME;
  wb.created = new Date();
  return wb;
}

// ------------------------------------------------------------------ Excel
export async function exportParticipantsXlsx({ participants }: ExportData) {
  const wb = await workbook();
  const ws = wb.addWorksheet("Peserta");
  ws.columns = [
    { header: "Nomor peserta", key: "no", width: 14 },
    { header: "Nama", key: "name", width: 32 },
    { header: "Username", key: "username", width: 20 },
    { header: "Status akun", key: "account", width: 14 },
    { header: "Status pengerjaan", key: "exam", width: 20 },
  ];
  for (const p of participants) {
    ws.addRow({
      no: p.participant_no,
      name: p.full_name,
      username: p.username,
      account: p.is_active ? "Aktif" : "Nonaktif",
      exam: EXAM_STATUS_LABEL[p.exam_status],
    });
  }
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf]), `peserta-${stamp()}.xlsx`);
}

export async function exportResultsXlsx({ participants, exam, stats }: ExportData) {
  const tz = exam.timezone;
  const wb = await workbook();
  const ws = wb.addWorksheet("Hasil");
  ws.columns = [
    { header: "Nomor peserta", key: "no", width: 13 },
    { header: "Nama", key: "name", width: 30 },
    { header: "Username", key: "username", width: 18 },
    { header: "Status ujian", key: "status", width: 18 },
    { header: "Nilai TWK", key: "twk", width: 10 },
    { header: "Nilai TIU", key: "tiu", width: 10 },
    { header: "Nilai TKP", key: "tkp", width: 10 },
    { header: "Nilai total", key: "total", width: 11 },
    { header: "Benar", key: "correct", width: 8 },
    { header: "Salah", key: "wrong", width: 8 },
    { header: "Kosong", key: "empty", width: 8 },
    { header: "Status passing grade", key: "passed", width: 28 },
    { header: "Waktu mulai", key: "start", width: 24 },
    { header: "Waktu selesai", key: "end", width: 24 },
    { header: "Durasi pengerjaan (menit)", key: "dur", width: 14 },
  ];
  for (const p of participants) {
    ws.addRow({
      no: p.participant_no,
      name: p.full_name,
      username: p.username,
      status: EXAM_STATUS_LABEL[p.exam_status],
      twk: p.twk_score,
      tiu: p.tiu_score,
      tkp: p.tkp_score,
      total: p.total_score,
      correct: p.correct_count,
      wrong: p.incorrect_count,
      empty: p.unanswered_count,
      passed: p.session_id && p.exam_status !== "in_progress" ? passedLabel(p.passed) : "-",
      start: p.started_at ? formatDateTime(p.started_at, tz) : "",
      end: p.submitted_at ? formatDateTime(p.submitted_at, tz) : "",
      dur: durationMinutes(p.started_at, p.submitted_at),
    });
  }
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: "O1" };

  const s = wb.addWorksheet("Ringkasan");
  s.columns = [
    { header: "Keterangan", key: "k", width: 30 },
    { header: "Nilai", key: "v", width: 30 },
  ];
  const cfg = exam.scoring_config;
  [
    ["Try Out", exam.title],
    ["Periode", `${formatDateTime(exam.start_at, tz)} – ${formatDateTime(exam.end_at, tz)}`],
    ["Durasi (menit)", exam.duration_minutes],
    ["Total peserta", stats.total_participants],
    ["Selesai", stats.finished],
    ["Tidak mengikuti", stats.not_participating],
    ["Rata-rata nilai", stats.avg_total],
    ["Nilai tertinggi", stats.max_total],
    ["Nilai terendah", stats.min_total],
    ["Rata-rata TWK", stats.avg_twk],
    ["Rata-rata TIU", stats.avg_tiu],
    ["Rata-rata TKP", stats.avg_tkp],
    ["Memenuhi ambang batas", stats.passed],
    [
      "Ambang batas",
      `TWK ${cfg.twk_min}, TIU ${cfg.tiu_min}, TKP ${cfg.tkp_min}${cfg.total_min ? `, total ${cfg.total_min}` : ""}`,
    ],
    ["Referensi", `${cfg.category} ${cfg.regulation_year ?? ""} — ${cfg.regulation_reference}`],
  ].forEach(([k, v]) => s.addRow({ k, v }));
  s.getRow(1).font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf]), `hasil-ujian-${stamp()}.xlsx`);
}

// ------------------------------------------------------------------ PDF
async function pdf(orientation: "portrait" | "landscape") {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  return { doc, autoTable };
}

function header(doc: import("jspdf").jsPDF, title: string, exam: Exam) {
  const tz = exam.timezone;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${APP_NAME} · ${exam.title}`, 14, 22);
  doc.text(
    `Pelaksanaan: ${formatDate(exam.start_at, tz)} (${formatDateTime(exam.start_at, tz)} – ${formatDateTime(exam.end_at, tz)})`,
    14,
    27,
  );
  doc.text(`Dicetak: ${formatDateTime(new Date().toISOString(), tz)}`, 14, 32);
}

function pageNumbers(doc: import("jspdf").jsPDF) {
  const n = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Halaman ${i} dari ${n}`, w - 14, h - 8, { align: "right" });
  }
}

function after(doc: import("jspdf").jsPDF, gap = 6) {
  const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return last ? last.finalY + gap : 37;
}

function statsRows(stats: DashboardStats, exam: Exam) {
  const cfg = exam.scoring_config;
  return [
    ["Total peserta", String(stats.total_participants)],
    ["Selesai (submit + waktu habis)", String(stats.finished)],
    ["Waktu habis", String(stats.timed_out)],
    ["Tidak mengikuti", String(stats.not_participating)],
    ["Rata-rata nilai total", String(stats.avg_total ?? "-")],
    ["Nilai tertinggi / terendah", `${stats.max_total ?? "-"} / ${stats.min_total ?? "-"}`],
    ["Rata-rata TWK / TIU / TKP", `${stats.avg_twk ?? "-"} / ${stats.avg_tiu ?? "-"} / ${stats.avg_tkp ?? "-"}`],
    ["Memenuhi ambang batas", String(stats.passed)],
    [
      "Ambang batas",
      `TWK ${cfg.twk_min}, TIU ${cfg.tiu_min}, TKP ${cfg.tkp_min}${cfg.total_min ? `, total ${cfg.total_min}` : ""} (${cfg.category} ${cfg.regulation_year ?? ""})`,
    ],
  ];
}

export async function exportRecapPdf({ participants, stats, exam }: ExportData) {
  const { doc, autoTable } = await pdf("landscape");
  header(doc, "Rekap Hasil Try Out", exam);
  autoTable(doc, {
    startY: 37,
    head: [["Ringkasan statistik", ""]],
    body: statsRows(stats, exam),
    theme: "grid",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [27, 47, 87] },
    tableWidth: 150,
  });
  const tz = exam.timezone;
  autoTable(doc, {
    startY: after(doc),
    head: [["No", "Nama", "Username", "Status", "TWK", "TIU", "TKP", "Total", "B", "S", "K", "Passing grade", "Mulai", "Selesai"]],
    body: participants.map((p) => [
      p.participant_no ?? "",
      p.full_name,
      p.username,
      EXAM_STATUS_LABEL[p.exam_status],
      p.twk_score ?? "",
      p.tiu_score ?? "",
      p.tkp_score ?? "",
      p.total_score ?? "",
      p.correct_count ?? "",
      p.incorrect_count ?? "",
      p.unanswered_count ?? "",
      p.session_id && p.exam_status !== "in_progress" ? (p.passed ? "Memenuhi" : "Tidak memenuhi") : "-",
      p.started_at ? formatTime(p.started_at, tz) : "",
      p.submitted_at ? formatTime(p.submitted_at, tz) : "",
    ]),
    theme: "striped",
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [27, 47, 87] },
    margin: { bottom: 14 },
  });
  pageNumbers(doc);
  doc.save(`rekap-hasil-${stamp()}.pdf`);
}

export async function exportStatsPdf({ stats, exam }: ExportData) {
  const { doc, autoTable } = await pdf("portrait");
  header(doc, "Ringkasan Statistik Try Out", exam);
  autoTable(doc, {
    startY: 37,
    head: [["Keterangan", "Nilai"]],
    body: statsRows(stats, exam),
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [27, 47, 87] },
  });
  pageNumbers(doc);
  doc.save(`statistik-${stamp()}.pdf`);
}

function addParticipantPage(
  doc: import("jspdf").jsPDF,
  autoTable: (d: import("jspdf").jsPDF, o: object) => void,
  p: ParticipantRow,
  exam: Exam,
) {
  const tz = exam.timezone;
  header(doc, "Laporan Hasil Peserta", exam);
  autoTable(doc, {
    startY: 37,
    head: [["Data peserta", ""]],
    body: [
      ["Nomor peserta", String(p.participant_no ?? "-")],
      ["Nama", p.full_name],
      ["Username", p.username],
      ["Status ujian", EXAM_STATUS_LABEL[p.exam_status]],
      ["Tanggal pengerjaan", formatDate(p.started_at, tz)],
      ["Waktu mulai", formatTime(p.started_at, tz)],
      ["Waktu selesai", formatTime(p.submitted_at, tz)],
      ["Durasi (menit)", String(durationMinutes(p.started_at, p.submitted_at) ?? "-")],
    ],
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [27, 47, 87] },
  });
  const cfg = exam.scoring_config;
  autoTable(doc, {
    startY: after(doc),
    head: [["Subtes", "Nilai", "Maksimum", "Ambang batas", "Keterangan"]],
    body: [
      ["TWK", p.twk_score ?? "-", 150, cfg.twk_min, (p.twk_score ?? 0) >= cfg.twk_min ? "Memenuhi" : "Belum memenuhi"],
      ["TIU", p.tiu_score ?? "-", 175, cfg.tiu_min, (p.tiu_score ?? 0) >= cfg.tiu_min ? "Memenuhi" : "Belum memenuhi"],
      ["TKP", p.tkp_score ?? "-", 225, cfg.tkp_min, (p.tkp_score ?? 0) >= cfg.tkp_min ? "Memenuhi" : "Belum memenuhi"],
      ["Total", p.total_score ?? "-", 550, cfg.total_min ?? "-", passedLabel(p.passed)],
    ],
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [27, 47, 87] },
  });
  autoTable(doc, {
    startY: after(doc),
    head: [["Benar (TWK+TIU)", "Salah (TWK+TIU)", "TKP dijawab", "Kosong"]],
    body: [[p.correct_count ?? "-", p.incorrect_count ?? "-", p.tkp_answered_count ?? "-", p.unanswered_count ?? "-"]],
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [100, 116, 139] },
  });
  doc.setFontSize(8);
  doc.text(
    "Memenuhi ambang batas dalam simulasi tidak berarti lulus seleksi CPNS yang sebenarnya.",
    14,
    after(doc, 8),
  );
}

export async function exportParticipantPdf(data: ExportData, participantId: string) {
  const p = data.participants.find((x) => x.id === participantId);
  if (!p) return;
  const { doc, autoTable } = await pdf("portrait");
  addParticipantPage(doc, autoTable as never, p, data.exam);
  pageNumbers(doc);
  doc.save(`hasil-${p.username}-${stamp()}.pdf`);
}

/** Satu PDF berisi laporan per peserta (satu halaman per peserta yang memiliki hasil). */
export async function exportAllParticipantPdfs(data: ExportData) {
  const list = data.participants.filter((p) => p.exam_status === "submitted" || p.exam_status === "timed_out");
  if (list.length === 0) return false;
  const { doc, autoTable } = await pdf("portrait");
  list.forEach((p, i) => {
    if (i > 0) doc.addPage();
    addParticipantPage(doc, autoTable as never, p, data.exam);
  });
  pageNumbers(doc);
  doc.save(`laporan-per-peserta-${stamp()}.pdf`);
  return true;
}
