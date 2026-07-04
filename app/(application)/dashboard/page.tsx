import { requireUser } from "@/app/lib/auth";
import { DashboardClient } from "./dashboard-client";
import type { ViewMode } from "@/components/ViewSwitcher";

export default async function DashboardPage() {
  const user = await requireUser();
  const initialView: ViewMode = user.defaultView === "solar" ? "solar" : "network";

  return (
    <DashboardClient
      initialView={initialView}
      isRaindropConnected={Boolean(user.raindropAccessToken)}
    />
  );
}
