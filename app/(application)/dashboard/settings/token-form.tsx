"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { disconnectRaindropToken } from "@/app/actions/raindrop/token.actions";

export function TokenForm({ initiallyConnected }: { initiallyConnected: boolean }) {
  const [connected, setConnected] = useState(initiallyConnected);
  const [isPending, startTransition] = useTransition();

  function handleDisconnect() {
    startTransition(async () => {
      try {
        await disconnectRaindropToken();
        setConnected(false);
        toast.success("Raindrop account disconnected");
      } catch {
        toast.error("Failed to disconnect");
      }
    });
  }

  if (connected) {
    return (
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Your Raindrop.io account is connected.
        </p>
        <Button variant="outline" onClick={handleDisconnect} disabled={isPending}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Connect your Raindrop.io account to sync your bookmarks.
      </p>
      <Button asChild>
        <a href="/api/raindrop/connect">Connect with Raindrop</a>
      </Button>
    </div>
  );
}
