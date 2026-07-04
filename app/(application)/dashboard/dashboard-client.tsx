"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Maximize2, Menu, Minimize2 } from "lucide-react";
import { Graph } from "@/components/Graph";
import { SolarSystemGraph } from "@/components/SolarSystemGraph";
import { PreviewCard } from "@/components/PreviewCard";
import { SearchFilter } from "@/components/SearchFilter";
import { SyncButton } from "@/components/SyncButton";
import { ViewSwitcher, type ViewMode } from "@/components/ViewSwitcher";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { GraphData, GraphRaindrop, PositionedRaindrop } from "@/lib/types";

const EMPTY_DATA: GraphData = { tags: [], collections: [], raindrops: [] };

function raindropMatchesQuery(r: GraphRaindrop, query: string): boolean {
  return r.title.toLowerCase().includes(query) || (r.excerpt?.toLowerCase().includes(query) ?? false);
}

export function DashboardClient({
  initialView,
  isRaindropConnected,
}: {
  initialView: ViewMode;
  isRaindropConnected: boolean;
}) {
  const [data, setData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTagIds, setActiveTagIds] = useState<Set<number>>(new Set());
  const [activeView, setActiveView] = useState<ViewMode>(initialView);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hovered, setHovered] = useState<{ raindrop: PositionedRaindrop; x: number; y: number } | null>(
    null
  );
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === graphContainerRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      graphContainerRef.current?.requestFullscreen();
    }
  }

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
      if (query && !raindropMatchesQuery(r, query)) continue;
      matches.add(r.id);
    }
    return matches;
  }, [graphData.raindrops, searchQuery, activeTagIds]);

  // Search-driven tag matching is independent of tag-click selection (which has its own
  // primary/related/faded focus system in the graph views) — a tag matches if its own name
  // matches, or it's attached to a raindrop whose title/excerpt matches. Only active when
  // there's actual query text, so it doesn't interact with tag-selection-only filtering.
  const matchingTagIds = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return null;

    const matchingRaindropTagIds = new Set<number>();
    for (const r of graphData.raindrops) {
      if (raindropMatchesQuery(r, query)) {
        for (const tagId of r.tagIds) matchingRaindropTagIds.add(tagId);
      }
    }

    const matches = new Set<number>();
    for (const tag of graphData.tags) {
      if (tag.name.toLowerCase().includes(query) || matchingRaindropTagIds.has(tag.id)) {
        matches.add(tag.id);
      }
    }
    return matches;
  }, [graphData.raindrops, graphData.tags, searchQuery]);

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
        {isRaindropConnected ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">No raindrops yet</h1>
            <p className="text-muted-foreground">
              Your Raindrop.io account is connected — run a sync to see your graph.
            </p>
            <SyncButton onSynced={fetchGraph} />
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Connect your Raindrop.io account</h1>
            <p className="text-muted-foreground">
              Connect your account to sync and visualize your bookmarks.
            </p>
            <Button asChild>
              <a href="/api/raindrop/connect">Connect Raindrop account</a>
            </Button>
          </>
        )}
      </main>
    );
  }

  const sharedGraphProps = {
    data: graphData,
    activeTagIds: activeTagIds.size > 0 ? activeTagIds : null,
    matchingRaindropIds,
    matchingTagIds,
    onHoverRaindrop: (raindrop: PositionedRaindrop | null, x: number, y: number) =>
      setHovered(raindrop ? { raindrop, x, y } : null),
    onHoverTag: () => {},
    onToggleTagFilter: toggleTagFilter,
  };

  return (
    <div className="relative flex h-[calc(100vh-73px)] w-full overflow-hidden">
      {isSidebarOpen ? (
        <div
          className="fixed inset-0 top-[73px] z-20 bg-black/50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <div
        className={cn(
          "fixed inset-y-0 left-0 top-[73px] z-30 h-[calc(100vh-73px)] overflow-x-hidden transition-transform duration-200 ease-in-out md:static md:z-auto md:h-full md:transition-[width] md:duration-200 md:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          isSidebarCollapsed ? "md:w-0" : "md:w-72"
        )}
      >
        <SearchFilter
          tags={graphData.tags}
          matchingTagIds={matchingTagIds}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          activeTagIds={activeTagIds}
          onToggleTagFilter={toggleTagFilter}
          onClearTagFilters={() => setActiveTagIds(new Set())}
          onClose={() => setIsSidebarOpen(false)}
          onCollapse={() => setIsSidebarCollapsed(true)}
        />
      </div>

      {isSidebarCollapsed ? (
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed(false)}
          aria-label="Expand tags panel"
          className="absolute left-0 top-8.5 z-40 hidden size-6 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent md:flex"
        >
          <ChevronRight className="size-3.5" />
        </button>
      ) : null}

      <div ref={graphContainerRef} className="relative min-w-0 flex-1 overflow-hidden bg-background">
        <div className="absolute left-4 top-4 z-10 md:hidden">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open tags panel"
          >
            <Menu className="size-4" />
          </Button>
        </div>

        <div className="absolute right-2 top-4 z-10 flex gap-1 sm:right-4 sm:gap-2">
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

        <div className="absolute bottom-4 right-4 z-10">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
