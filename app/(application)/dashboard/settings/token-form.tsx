"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  saveRaindropToken,
  disconnectRaindropToken,
} from "@/app/actions/raindrop/token.actions";

export function TokenForm({ initiallyConnected }: { initiallyConnected: boolean }) {
  const [connected, setConnected] = useState(initiallyConnected);
  const [token, setToken] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!token.trim()) return;
    startTransition(async () => {
      try {
        await saveRaindropToken(token);
        setToken("");
        setConnected(true);
        toast.success("Raindrop account connected");
      } catch {
        toast.error("Failed to save token");
      }
    });
  }

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
      <Input
        type="password"
        placeholder="Paste your Raindrop.io test token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        autoComplete="off"
      />
      <Button onClick={handleSave} disabled={isPending || !token.trim()}>
        Connect
      </Button>
    </div>
  );
}
