import { requireUser } from "@/app/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TokenForm } from "./token-form";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 p-6 pt-18.25">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Raindrop.io account</CardTitle>
          <CardDescription>
            Connect your Raindrop.io account to sync and visualize your own bookmarks. Tokens
            are encrypted before they&apos;re stored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TokenForm initiallyConnected={Boolean(user.raindropAccessToken)} />
        </CardContent>
      </Card>
    </main>
  );
}
