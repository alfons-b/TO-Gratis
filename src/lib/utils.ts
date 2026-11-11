import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ParticipantExamStatus, Subtest, TimezoneId } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Domain internal untuk memetakan username -> identitas Supabase Auth. Tidak pernah dipakai mengirim email. */
export const INTERNAL_EMAIL_DOMAIN = "akun.tryout-skd.example.com";

export function normalizeUsername(u: string) {
  return u.trim().toLowerCase();
}

export function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@${INTERNAL_EMAIL_DOMAIN}`;
}

export const USERNAME_REGEX = /^[a-z0-9_.]{3,32}$/;

export const TZ_LABEL: Record<TimezoneId, string> = {
  "Asia/Jakarta": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

export const TZ_OFFSET: Record<TimezoneId, string> = {
  "Asia/Jakarta": "+07:00",
  "Asia/Makassar": "+08:00",
  "Asia/Jayapura": "+09:00",
};

export function formatDateTime(iso: string | null | undefined, tz: TimezoneId = "Asia/Jakarta") {
  if (!iso) return "-";
  const d = new Date(iso);
  const s = new Intl.DateTimeFormat("id-ID", {
    timeZone: tz,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${s} ${TZ_LABEL[tz]}`;
}

export function formatDate(iso: string | null | undefined, tz: TimezoneId = "Asia/Jakarta") {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: tz,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatTime(iso: string | null | undefined, tz: TimezoneId = "Asia/Jakarta") {
  if (!iso) return "-";
  const s = new Intl.DateTimeFormat("id-ID", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  return `${s} ${TZ_LABEL[tz]}`;
}

/** ISO -> nilai untuk <input type="datetime-local"> pada zona tertentu. */
export function isoToLocalInput(iso: string | null | undefined, tz: TimezoneId) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** Nilai <input type="datetime-local"> (dianggap di zona tz) -> ISO UTC. */
export function localInputToIso(value: string, tz: TimezoneId) {
  if (!value) return null;
  const d = new Date(`${value}:00${TZ_OFFSET[tz]}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatDuration(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) return "-";
  const ms = Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime());
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h} j ${m} m ${s} d` : `${m} m ${s} d`;
}

export function durationMinutes(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) return null;
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 6000) / 10;
}

export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function subtestOf(n: number): Subtest {
  if (n <= 30) return "TWK";
  if (n <= 65) return "TIU";
  return "TKP";
}

export const SUBTEST_RANGES: { subtest: Subtest; from: number; to: number; label: string }[] = [
  { subtest: "TWK", from: 1, to: 30, label: "Tes Wawasan Kebangsaan" },
  { subtest: "TIU", from: 31, to: 65, label: "Tes Intelegensia Umum" },
  { subtest: "TKP", from: 66, to: 110, label: "Tes Karakteristik Pribadi" },
];

export const EXAM_STATUS_LABEL: Record<ParticipantExamStatus, string> = {
  not_started: "Belum memulai",
  in_progress: "Sedang mengerjakan",
  submitted: "Selesai",
  timed_out: "Waktu habis",
  not_participating: "Tidak mengikuti",
};

export function passedLabel(passed: boolean | null | undefined) {
  if (passed === null || passed === undefined) return "-";
  return passed ? "Memenuhi ambang batas" : "Tidak memenuhi ambang batas";
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Florata Academy";
export const LOGO_URL = process.env.NEXT_PUBLIC_LOGO_URL || "/logo.png";
