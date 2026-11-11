import { getExam, getParticipants } from "../actions";
import { ResultsClient } from "./results-client";

export default async function HasilAdminPage() {
  const [rows, exam] = await Promise.all([getParticipants(), getExam()]);
  return <ResultsClient rows={rows} exam={exam} />;
}
