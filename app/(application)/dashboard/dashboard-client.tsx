"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Graph } from "@/components/Graph";
import { SolarSystemGraph } from "@/components/SolarSystemGraph";
import { PreviewCard } from "@/components/PreviewCard";
import { SearchFilter } from "@/components/SearchFilter";
import { SyncButton } from "@/components/SyncButton";
import { ViewSwitcher, type ViewMode } from "@/components/ViewSwitcher";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES } from "@/app/lib/constants";
import type { GraphData, PositionedRaindrop } from "@/lib/types";

const EMPTY_DATA: GraphData = { tags: [], collections: [], raindrops: [] };

export function DashboardClient({ initialView }: { initialView: ViewMode }) {
  const [data, setData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTagIds, setActiveTagIds] = useState<Set<number>>(new Set());
  const [activeView, setActiveView] = useState<ViewMode>(initialView);
  const [hovered, setHovered] = useState<{ raindrop: PositionedRaindrop; x: number; y: number } | null>(
    null
  );

  const fetchGraph = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/graph");
      const body: GraphData = await res.json();
      setData(body);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const graphData = data ?? EMPTY_DATA;

  const matchingRaindropIds = useMemo(() => {
    const hasFilters = searchQuery.trim() !== "" || activeTagIds.size > 0;
    if (!hasFilters) return null;

    const query = searchQuery.trim().toLowerCase();
    const matches = new Set<number>();
    for (const r of graphData.raindrops) {
      if (activeTagIds.size > 0 && !r.tagIds.some((id) => activeTagIds.has(id))) continue;
      if (query && !r.title.toLowerCase().includes(query) && !r.excerpt?.toLowerCase().includes(query))
        continue;
      matches.add(r.id);
    }
    return matches;
  }, [graphData.raindrops, searchQuery, activeTagIds]);

  function toggleTagFilter(tagId: number) {
    setActiveTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  if (!isLoading && graphData.raindrops.length === 0) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">No raindrops yet</h1>
        <p className="text-muted-foreground">
          Connect your Raindrop.io account and run a sync to see your graph.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={ROUTES.SETTINGS}>Go to Settings</Link>
          </Button>
          <SyncButton onSynced={fetchGraph} />
        </div>
      </main>
    );
  }

  const sharedGraphProps = {
    data: graphData,
    activeTagIds: activeTagIds.size > 0 ? activeTagIds : null,
    matchingRaindropIds,
    onHoverRaindrop: (raindrop: PositionedRaindrop | null, x: number, y: number) =>
      setHovered(raindrop ? { raindrop, x, y } : null),
    onHoverTag: () => {},
    onToggleTagFilter: toggleTagFilter,
  };

  return (
    <div className="flex h-[calc(100vh-73px)] w-full">
      <SearchFilter
        tags={graphData.tags}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        activeTagIds={activeTagIds}
        onToggleTagFilter={toggleTagFilter}
        onClearTagFilters={() => setActiveTagIds(new Set())}
      />

      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="absolute right-4 top-4 z-10 flex gap-2">
          <ViewSwitcher view={activeView} onChange={setActiveView} />
          <SyncButton onSynced={fetchGraph} />
        </div>

        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : (
          <div key={activeView} className="h-full w-full animate-in fade-in duration-300 ease-out">
            {activeView === "network" ? (
              <Graph {...sharedGraphProps} />
            ) : (
              <SolarSystemGraph {...sharedGraphProps} />
            )}
          </div>
        )}

        {hovered ? (
          <PreviewCard raindrop={hovered.raindrop} x={hovered.x} y={hovered.y} />
        ) : null}
      </div>
    </div>
  );
}
