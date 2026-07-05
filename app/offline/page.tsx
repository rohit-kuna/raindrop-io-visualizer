import { WifiOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md py-8">
        <CardHeader className="px-8">
          <CardTitle className="flex items-center gap-2 text-2xl tracking-tight">
            <WifiOff className="size-5" />
            You&apos;re offline
          </CardTitle>
        </CardHeader>
        <CardContent className="px-8 text-sm text-muted-foreground">
          Mindverse needs an internet connection to load your graph. Reconnect and reload to
          continue.
        </CardContent>
      </Card>
    </main>
  );
}
