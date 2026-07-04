import { requireUser } from "@/app/lib/auth";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const user = await requireUser();

  return <DashboardClient isRaindropConnected={Boolean(user.raindropAccessToken)} />;
}
