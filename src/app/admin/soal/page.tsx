import { createClient } from "@/lib/supabase/server";
import type { Question } from "@/lib/types";
import { getExam } from "../actions";
import { QuestionsClient } from "./questions-client";

export default async function SoalPage() {
  const exam = await getExam();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("exam_id", exam.id)
    .order("question_number")
    .order("created_at");
  if (error) throw new Error(error.message);
  const locked = exam.status === "open" || exam.status === "closed";
  return <QuestionsClient questions={(data as Question[]) ?? []} locked={locked} />;
}
