import { getDashboard, getExam } from "./actions";
import { DashboardClient } from "./dashboard-client";

export default async function AdminDashboardPage() {
  const [initial, exam] = await Promise.all([getDashboard(), getExam()]);
  return <DashboardClient initial={initial} exam={exam} />;
}
