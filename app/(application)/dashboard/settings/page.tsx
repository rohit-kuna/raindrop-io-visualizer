import { requireUser } from "@/app/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TokenForm } from "./token-form";
import { DefaultViewForm } from "./default-view-form";
import type { ViewMode } from "@/app/actions/settings/view.actions";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Raindrop.io account</CardTitle>
          <CardDescription>
            Connect a Raindrop.io{" "}
            <a
              href="https://app.raindrop.io/settings/integrations"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              test token
            </a>{" "}
            to sync and visualize your own bookmarks. The token is encrypted before it&apos;s
            stored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TokenForm initiallyConnected={Boolean(user.raindropToken)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default view</CardTitle>
          <CardDescription>
            Choose which visualization opens by default on the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DefaultViewForm initialView={(user.defaultView === "solar" ? "solar" : "network") as ViewMode} />
        </CardContent>
      </Card>
    </main>
  );
}
