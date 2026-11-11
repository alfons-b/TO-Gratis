import { createClient } from "@/lib/supabase/server";
import { getExam } from "../actions";
import { TokenClient } from "./token-client";

export default async function TokenPage() {
  const exam = await getExam();
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_token_status");
  const status = data as { exists: boolean; is_active?: boolean; created_at?: string; updated_at?: string };
  return <TokenClient status={status} timezone={exam.timezone} />;
}
