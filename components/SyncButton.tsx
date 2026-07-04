"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type SyncButtonProps = {
  onSynced: () => void | Promise<void>;
};

export function SyncButton({ onSynced }: SyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  async function handleSync() {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const body = await res.json();

      if (!res.ok) {
        toast.error(body.error ?? "Sync failed");
        return;
      }

      toast.success(`Synced ${body.totalRaindrops} raindrops / ${body.totalTags} tags`);
      setLastSyncedAt(new Date());
      await onSynced();
    } catch {
      toast.error("Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {lastSyncedAt ? (
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Synced {lastSyncedAt.toLocaleTimeString()}
        </span>
      ) : null}
      <Button size="sm" variant="outline" onClick={handleSync} disabled={isSyncing}>
        <RefreshCw className={isSyncing ? "animate-spin" : ""} />
        {isSyncing ? "Syncing..." : "Sync"}
      </Button>
    </div>
  );
}
