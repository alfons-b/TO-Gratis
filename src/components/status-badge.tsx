import { Badge } from "@/components/ui/card";
import type { ExamStatus, ParticipantExamStatus } from "@/lib/types";
import { EXAM_STATUS_LABEL } from "@/lib/utils";

export function ParticipantStatusBadge({ status }: { status: ParticipantExamStatus }) {
  const tone = {
    not_started: "muted",
    in_progress: "warning",
    submitted: "success",
    timed_out: "info",
    not_participating: "danger",
  } as const;
  return <Badge tone={tone[status]}>{EXAM_STATUS_LABEL[status]}</Badge>;
}

export function ExamStatusBadge({ status, startAt, endAt }: { status: ExamStatus; startAt: string | null; endAt: string | null }) {
  const now = Date.now();
  if (status === "closed") return <Badge tone="danger">Ditutup</Badge>;
  if (status === "open") {
    if (startAt && now < new Date(startAt).getTime()) return <Badge tone="info">Dibuka · menunggu jadwal mulai</Badge>;
    if (endAt && now >= new Date(endAt).getTime()) return <Badge tone="muted">Dibuka · periode berakhir</Badge>;
    return <Badge tone="success">Berlangsung</Badge>;
  }
  return <Badge tone="muted">Draft</Badge>;
}
