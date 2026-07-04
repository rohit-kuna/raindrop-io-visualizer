"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveDefaultView, type ViewMode } from "@/app/actions/settings/view.actions";

export function DefaultViewForm({ initialView }: { initialView: ViewMode }) {
  const [view, setView] = useState<ViewMode>(initialView);
  const [isPending, startTransition] = useTransition();

  function handleSelect(next: ViewMode) {
    if (next === view) return;
    startTransition(async () => {
      try {
        await saveDefaultView(next);
        setView(next);
        toast.success("Default view updated");
      } catch {
        toast.error("Failed to update default view");
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button
        variant={view === "network" ? "default" : "outline"}
        disabled={isPending}
        onClick={() => handleSelect("network")}
      >
        Tag Network
      </Button>
      <Button
        variant={view === "solar" ? "default" : "outline"}
        disabled
        title="Solar System view is temporarily disabled"
        onClick={() => handleSelect("solar")}
      >
        Solar System
      </Button>
    </div>
  );
}
