import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getExam } from "../actions";
import { AccountClient } from "./account-client";

export default async function AkunPage() {
  const admin = await requireAdmin();
  const exam = await getExam();
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id,action,target_type,target_id,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return (
    <AccountClient
      username={admin.username}
      timezone={exam.timezone}
      logs={(logs ?? []) as { id: string; action: string; target_type: string | null; metadata: Record<string, unknown>; created_at: string }[]}
    />
  );
}
