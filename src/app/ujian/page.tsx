import { requireParticipant } from "@/lib/auth";
import { ExamRunner } from "./exam-runner";

export const dynamic = "force-dynamic";

export default async function UjianPage() {
  const profile = await requireParticipant();
  return <ExamRunner participantName={profile.full_name} />;
}
