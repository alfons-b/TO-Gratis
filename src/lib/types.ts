export type Role = "admin" | "participant";
export type Subtest = "TWK" | "TIU" | "TKP";
export type OptionKey = "A" | "B" | "C" | "D" | "E";
export const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D", "E"];

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  participant_no: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScoringConfig {
  category: string;
  regulation_year: number | null;
  regulation_reference: string;
  twk_min: number;
  tiu_min: number;
  tkp_min: number;
  total_min: number | null;
}

export type ExamStatus = "draft" | "scheduled" | "open" | "closed";
export type TimezoneId = "Asia/Jakarta" | "Asia/Makassar" | "Asia/Jayapura";

export interface Exam {
  id: string;
  title: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  timezone: TimezoneId;
  duration_minutes: number;
  status: ExamStatus;
  scoring_config: ScoringConfig;
  opened_at: string | null;
  closed_at: string | null;
}

export interface Question {
  id: string;
  exam_id: string;
  subtest: Subtest;
  question_number: number;
  question_text: string;
  image_url: string | null;
  options: Record<OptionKey, string>;
  correct_answer: OptionKey | null;
  tkp_scores: Record<OptionKey, number> | null;
  is_active: boolean;
}

/** Soal yang dikirim ke peserta — tanpa kunci jawaban/bobot. */
export interface ExamQuestion {
  id: string;
  subtest: Subtest;
  number: number;
  text: string;
  image_url: string | null;
  options: Record<OptionKey, string>;
}

export type ParticipantExamStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "timed_out"
  | "not_participating";

export interface ParticipantRow {
  id: string;
  participant_no: number | null;
  full_name: string;
  username: string;
  is_active: boolean;
  created_at: string;
  session_id: string | null;
  exam_status: ParticipantExamStatus;
  started_at: string | null;
  deadline_at: string | null;
  submitted_at: string | null;
  twk_score: number | null;
  tiu_score: number | null;
  tkp_score: number | null;
  total_score: number | null;
  correct_count: number | null;
  incorrect_count: number | null;
  unanswered_count: number | null;
  tkp_answered_count: number | null;
  passed: boolean | null;
  last_heartbeat_at: string | null;
  finalize_reason: string | null;
}

export interface DashboardStats {
  total_participants: number;
  active_accounts: number;
  not_started: number;
  in_progress: number;
  finished: number;
  timed_out: number;
  not_participating: number;
  total_questions: number;
  avg_total: number | null;
  max_total: number | null;
  min_total: number | null;
  avg_twk: number | null;
  avg_tiu: number | null;
  avg_tkp: number | null;
  passed: number;
  server_now: string;
}

export interface MyResult {
  status: "in_progress" | "submitted" | "timed_out";
  full_name: string;
  username: string;
  exam_title: string;
  timezone: TimezoneId;
  started_at: string;
  submitted_at: string | null;
  deadline_at: string;
  finalize_reason: string | null;
  twk_score: number | null;
  tiu_score: number | null;
  tkp_score: number | null;
  total_score: number | null;
  correct_count: number | null;
  incorrect_count: number | null;
  unanswered_count: number | null;
  tkp_answered_count: number | null;
  passed: boolean | null;
  scoring_config: ScoringConfig;
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };
