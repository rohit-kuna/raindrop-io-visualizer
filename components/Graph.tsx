"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { forceCollide, forceManyBody } from "d3-force";
import type ForceGraph2DComponent from "react-force-graph-2d";
import type { ForceGraphMethods, NodeObject, LinkObject } from "react-force-graph-2d";
import {
  computeTagNetwork,
  buildNeighborIndex,
  makeLinkWidthScale,
  tagNodeId,
  RAINDROP_DOT_RADIUS,
  MEMBERSHIP_LINK_WIDTH,
  MEMBERSHIP_LINK_OPACITY,
  type TagNetworkNode,
  type TagNetworkLink,
  type CooccurrenceLink,
  type RaindropNode,
} from "@/lib/layout/tagNetwork";
import type { GraphData, PositionedRaindrop } from "@/lib/types";
import { useContainerSize } from "@/lib/hooks/useContainerSize";
import { fitCircleLabelFontSize } from "@/lib/canvas/fitCircleLabel";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
}) as unknown as typeof ForceGraph2DComponent;

type FGNode = NodeObject<TagNetworkNode>;
type FGLink = LinkObject<TagNetworkNode, TagNetworkLink>;

export type GraphProps = {
  data: GraphData;
  activeTagIds: Set<number> | null;
  matchingRaindropIds: Set<number> | null;
  matchingTagIds: Set<number> | null;
  onHoverRaindrop: (raindrop: PositionedRaindrop | null, screenX: number, screenY: number) => void;
  onHoverTag: (tagId: number | null) => void;
  onToggleTagFilter: (tagId: number) => void;
};

function toPositionedRaindrop(node: RaindropNode & { x?: number; y?: number }): PositionedRaindrop {
  return {
    id: node.raindropId,
    title: node.title,
    link: node.link,
    domain: node.domain,
    cover: node.cover,
    excerpt: node.excerpt,
    createdAt: node.createdAt,
    collectionId: node.collectionId,
    tagIds: node.tagIds,
    x: node.x ?? 0,
    y: node.y ?? 0,
  };
}

export function Graph({
  data,
  activeTagIds,
  matchingRaindropIds,
  matchingTagIds,
  onHoverRaindrop,
  onHoverTag,
  onToggleTagFilter,
}: GraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<TagNetworkNode, TagNetworkLink> | undefined>(undefined);
  const [hoveredNode, setHoveredNode] = useState<TagNetworkNode | null>(null);
  const { width, height } = useContainerSize(containerRef);
  const { resolvedTheme } = useTheme();
  // The canvas background follows the page theme, so link lines need to flip too — white lines
  // are invisible against the light-mode background.
  const lineRgb = resolvedTheme === "light" ? "0,0,0" : "255,255,255";
  // Hovered nodes get a solid highlight fill — white reads fine on the dark canvas but
  // disappears on light-mode's light background, so flip to near-black there. The label color
  // then flips opposite so the tag name stays readable against whichever fill is used.
  const hoverFillColor = resolvedTheme === "light" ? "#111111" : "#ffffff";
  const hoverLabelColor = resolvedTheme === "light" ? "#ffffff" : "#111111";

  const network = useMemo(() => computeTagNetwork(data), [data]);
  const { neighborsByNodeId, linksByNodeId } = useMemo(() => buildNeighborIndex(network), [network]);
  const linkWidthScale = useMemo(() => {
    const cooccurrenceLinks = network.links.filter(
      (l): l is CooccurrenceLink => l.kind === "cooccurrence"
    );
    return makeLinkWidthScale(cooccurrenceLinks);
  }, [network.links]);

  // When one or more tags are selected, the selected tag(s) and their own raindrops (via
  // membership links) are "in focus" at full opacity, with those membership connection lines
  // drawn in. Tags one hop away via a cooccurrence link are shown as subtly-highlighted circles,
  // without a connecting line. Everything else fades to a faint ghost.
  const selectedTagIds = useMemo(() => {
    if (!activeTagIds || activeTagIds.size === 0) return null;
    return new Set([...activeTagIds].map(tagNodeId));
  }, [activeTagIds]);

  function linkEndpointIds(link: TagNetworkLink): [string, string] {
    const sourceId = typeof link.source === "string" ? link.source : (link.source as { id: string }).id;
    const targetId = typeof link.target === "string" ? link.target : (link.target as { id: string }).id;
    return [sourceId, targetId];
  }

  const selectionRelevantNodeIds = useMemo(() => {
    if (!selectedTagIds) return null;
    const ids = new Set<string>(selectedTagIds);
    for (const link of network.links) {
      if (link.kind !== "membership") continue;
      const [sourceId, targetId] = linkEndpointIds(link);
      if (selectedTagIds.has(targetId)) ids.add(sourceId);
    }
    return ids;
  }, [selectedTagIds, network.links]);

  const selectionRelatedTagIds = useMemo(() => {
    if (!selectedTagIds) return null;
    const related = new Set<string>();
    for (const link of network.links) {
      if (link.kind !== "cooccurrence") continue;
      const [sourceId, targetId] = linkEndpointIds(link);
      if (selectedTagIds.has(sourceId) && !selectedTagIds.has(targetId)) related.add(targetId);
      else if (selectedTagIds.has(targetId) && !selectedTagIds.has(sourceId)) related.add(sourceId);
    }
    return related;
  }, [selectedTagIds, network.links]);

  // Only the selected tag's own membership links stay drawn in; cooccurrence links to related
  // tags are fully faded — related tags are shown as subtly-highlighted circles without a
  // connecting line, to keep the focused view uncluttered.
  const linkFocusTier = useCallback(
    (link: TagNetworkLink): "primary" | "faded" => {
      const [, targetId] = linkEndpointIds(link);
      return link.kind === "membership" && selectedTagIds!.has(targetId) ? "primary" : "faded";
    },
    [selectedTagIds]
  );

  useEffect(() => {
    // ForceGraph2D is a next/dynamic (ssr:false) component, so it can still be mounting
    // asynchronously on this first effect run — [network] never changes again for a given
    // `data`, so bailing out here permanently would mean the custom charge/collide/link
    // tuning below never gets applied and the graph silently falls back to bare d3-force
    // defaults. Retry each frame until the ref actually lands.
    let cancelled = false;
    let rafId: number;

    function setupForces() {
      const fg = fgRef.current;
      if (!fg) {
        rafId = requestAnimationFrame(setupForces);
        return;
      }
      if (cancelled) return;

      fg.d3Force(
        "charge",
        forceManyBody<FGNode>().strength((n) => ((n as unknown as TagNetworkNode).kind === "tag" ? -200 : -8))
      );
      fg.d3Force(
        "collide",
        forceCollide<FGNode>((n) => {
          const node = n as unknown as TagNetworkNode;
          return node.kind === "tag" ? node.radius + 2 : RAINDROP_DOT_RADIUS + 1;
        })
      );
      const linkForce = fg.d3Force("link");
      if (linkForce) {
        linkForce
          .distance((l: unknown) => ((l as TagNetworkLink).kind === "membership" ? 30 : 80))
          .strength((l: unknown) => {
            const link = l as TagNetworkLink;
            return link.kind === "cooccurrence" ? Math.min(1, link.weight / 10) : 0.5;
          });
      }
      fg.d3ReheatSimulation();
    }

    setupForces();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [network]);

  const isNodeRelated = useCallback(
    (node: TagNetworkNode): boolean => {
      return node.kind === "tag" && (selectionRelatedTagIds?.has(node.id) ?? false);
    },
    [selectionRelatedTagIds]
  );

  const isNodeDimmed = useCallback(
    (node: TagNetworkNode): boolean => {
      if (node.kind === "raindrop" && matchingRaindropIds !== null && !matchingRaindropIds.has(node.raindropId)) {
        return true;
      }
      if (node.kind === "tag" && matchingTagIds !== null && !matchingTagIds.has(node.tagId)) {
        return true;
      }
      if (selectionRelevantNodeIds && !selectionRelevantNodeIds.has(node.id) && !isNodeRelated(node)) {
        return true;
      }
      if (hoveredNode && node.id !== hoveredNode.id) {
        const neighbors = neighborsByNodeId.get(hoveredNode.id);
        if (!neighbors?.has(node.id)) return true;
      }
      return false;
    },
    [selectionRelevantNodeIds, isNodeRelated, matchingRaindropIds, matchingTagIds, hoveredNode, neighborsByNodeId]
  );

  // A search (title/excerpt or tag-name query) fades any link that doesn't have both endpoints
  // matching — a membership link needs its raindrop in matchingRaindropIds AND its tag in
  // matchingTagIds; a cooccurrence link needs both tags in matchingTagIds. Independent of, and
  // takes priority over, the tag-selection focus tiering below.
  const isLinkMatchingSearch = useCallback(
    (link: TagNetworkLink): boolean => {
      if (matchingRaindropIds === null && matchingTagIds === null) return true;
      const [sourceId, targetId] = linkEndpointIds(link);
      if (link.kind === "membership") {
        const raindropId = Number(sourceId.split(":")[1]);
        const tagId = Number(targetId.split(":")[1]);
        return (
          (matchingRaindropIds === null || matchingRaindropIds.has(raindropId)) &&
          (matchingTagIds === null || matchingTagIds.has(tagId))
        );
      }
      const tagIdA = Number(sourceId.split(":")[1]);
      const tagIdB = Number(targetId.split(":")[1]);
      return (
        (matchingTagIds === null || matchingTagIds.has(tagIdA)) &&
        (matchingTagIds === null || matchingTagIds.has(tagIdB))
      );
    },
    [matchingRaindropIds, matchingTagIds]
  );

  const isLinkHighlighted = useCallback(
    (link: TagNetworkLink): boolean => {
      if (!hoveredNode) return false;
      return linksByNodeId.get(hoveredNode.id)?.has(link) ?? false;
    },
    [hoveredNode, linksByNodeId]
  );

  const nodeCanvasObject = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D) => {
      const n = node as unknown as TagNetworkNode & { x?: number; y?: number };
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      const dimmed = isNodeDimmed(n);
      const related = isNodeRelated(n);
      const isHovered = n.id === hoveredNode?.id;

      if (n.kind === "tag") {
        ctx.globalAlpha = dimmed ? 0.06 : related ? 0.18 : 1;
        ctx.fillStyle = isHovered ? hoverFillColor : n.color;
        ctx.beginPath();
        ctx.arc(x, y, n.radius, 0, Math.PI * 2);
        ctx.fill();

        if (n.radius > 6) {
          const fontSize = fitCircleLabelFontSize(ctx, n.name, n.radius);
          ctx.globalAlpha = dimmed ? 0.15 : related ? 0.35 : 1;
          ctx.fillStyle = isHovered ? hoverLabelColor : "#fff";
          ctx.font = `600 ${fontSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(n.name, x, y, n.radius * 1.7);
        }
      } else {
        ctx.globalAlpha = dimmed ? 0.04 : 0.85;
        ctx.fillStyle = isHovered ? hoverFillColor : "#a3a3a3";
        ctx.beginPath();
        ctx.arc(x, y, isHovered ? RAINDROP_DOT_RADIUS + 1.5 : RAINDROP_DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    [hoveredNode, isNodeDimmed, isNodeRelated, hoverFillColor, hoverLabelColor]
  );

  const linkWidth = useCallback(
    (link: FGLink) => {
      const l = link as unknown as TagNetworkLink;
      const base = l.kind === "membership" ? MEMBERSHIP_LINK_WIDTH : linkWidthScale(l.weight);
      if (!isLinkMatchingSearch(l)) return base * 0.4;
      if (selectedTagIds) {
        return linkFocusTier(l) === "primary" ? 1.2 : base * 0.4;
      }
      return isLinkHighlighted(l) ? base + 2 : base;
    },
    [linkWidthScale, selectedTagIds, linkFocusTier, isLinkHighlighted, isLinkMatchingSearch]
  );

  const linkColor = useCallback(
    (link: FGLink) => {
      const l = link as unknown as TagNetworkLink;
      if (!isLinkMatchingSearch(l)) return `rgba(${lineRgb},0.02)`;
      if (selectedTagIds) {
        return linkFocusTier(l) === "primary" ? `rgba(${lineRgb},0.5)` : `rgba(${lineRgb},0.02)`;
      }
      if (l.kind === "membership") {
        return isLinkHighlighted(l) ? `rgba(${lineRgb},0.6)` : `rgba(${lineRgb},${MEMBERSHIP_LINK_OPACITY})`;
      }
      return isLinkHighlighted(l) ? `rgba(${lineRgb},0.9)` : `rgba(${lineRgb},0.35)`;
    },
    [selectedTagIds, linkFocusTier, isLinkHighlighted, lineRgb, isLinkMatchingSearch]
  );

  const handleNodeHover = useCallback(
    (node: FGNode | null) => {
      const n = node as unknown as (TagNetworkNode & { x?: number; y?: number }) | null;
      setHoveredNode(n);

      if (!n) {
        onHoverRaindrop(null, 0, 0);
        onHoverTag(null);
        return;
      }

      if (n.kind === "raindrop") {
        onHoverTag(null);
        const fg = fgRef.current;
        const container = containerRef.current;
        if (fg && container && n.x !== undefined && n.y !== undefined) {
          const { x: screenX, y: screenY } = fg.graph2ScreenCoords(n.x, n.y);
          const rect = container.getBoundingClientRect();
          onHoverRaindrop(toPositionedRaindrop(n), rect.left + screenX, rect.top + screenY);
        }
      } else {
        onHoverRaindrop(null, 0, 0);
        onHoverTag(n.tagId);
      }
    },
    [onHoverRaindrop, onHoverTag]
  );

  const handleNodeClick = useCallback(
    (node: FGNode) => {
      const n = node as unknown as TagNetworkNode;
      if (n.kind === "tag") {
        onToggleTagFilter(n.tagId);
      } else {
        window.open(n.link, "_blank", "noopener,noreferrer");
      }
    },
    [onToggleTagFilter]
  );

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <ForceGraph2D<TagNetworkNode, TagNetworkLink>
        ref={fgRef}
        width={width}
        height={height}
        graphData={network as unknown as { nodes: FGNode[]; links: FGLink[] }}
        nodeId="id"
        nodeVal="val"
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => "replace"}
        linkWidth={linkWidth}
        linkColor={linkColor}
        linkDirectionalParticles={0}
        cooldownTicks={300}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        warmupTicks={100}
        enableNodeDrag={true}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
}
