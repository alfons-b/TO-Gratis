import { getParticipants } from "../actions";
import { ParticipantsClient } from "./participants-client";

export const maxDuration = 60;

export default async function PesertaAdminPage() {
  const rows = await getParticipants();
  return <ParticipantsClient rows={rows} />;
}
