import { createClient } from "@/lib/supabase/server";
import { getExam, validateExam } from "../actions";
import { ExamSettingsClient } from "./exam-settings-client";

export default async function UjianSettingsPage() {
  const [exam, problems] = await Promise.all([getExam(), validateExam()]);
  const supabase = await createClient();
  const { count } = await supabase
    .from("exam_sessions")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", exam.id);
  return <ExamSettingsClient exam={exam} problems={problems} sessionCount={count ?? 0} />;
}
