"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { forceCollide, forceManyBody } from "d3-force";
import type ForceGraph2DComponent from "react-force-graph-2d";
import type { ForceGraphMethods, NodeObject, LinkObject } from "react-force-graph-2d";
import {
  computeTagNetwork,
  buildNeighborIndex,
  makeLinkWidthScale,
  RAINDROP_DOT_RADIUS,
  MEMBERSHIP_LINK_WIDTH,
  MEMBERSHIP_LINK_OPACITY,
  type TagNetworkNode,
  type TagNetworkLink,
  type CooccurrenceLink,
  type RaindropNode,
} from "@/lib/layout/tagNetwork";
import type { GraphData, PositionedRaindrop } from "@/lib/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
}) as unknown as typeof ForceGraph2DComponent;

type FGNode = NodeObject<TagNetworkNode>;
type FGLink = LinkObject<TagNetworkNode, TagNetworkLink>;

export type GraphProps = {
  data: GraphData;
  activeTagIds: Set<number> | null;
  matchingRaindropIds: Set<number> | null;
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
  onHoverRaindrop,
  onHoverTag,
  onToggleTagFilter,
}: GraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<TagNetworkNode, TagNetworkLink> | undefined>(undefined);
  const [hoveredNode, setHoveredNode] = useState<TagNetworkNode | null>(null);

  const network = useMemo(() => computeTagNetwork(data), [data]);
  const { neighborsByNodeId, linksByNodeId } = useMemo(() => buildNeighborIndex(network), [network]);
  const linkWidthScale = useMemo(() => {
    const cooccurrenceLinks = network.links.filter(
      (l): l is CooccurrenceLink => l.kind === "cooccurrence"
    );
    return makeLinkWidthScale(cooccurrenceLinks);
  }, [network.links]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
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
  }, [network]);

  const isNodeDimmed = useCallback(
    (node: TagNetworkNode): boolean => {
      if (node.kind === "raindrop" && matchingRaindropIds !== null && !matchingRaindropIds.has(node.raindropId)) {
        return true;
      }
      if (node.kind === "tag" && activeTagIds !== null && activeTagIds.size > 0 && !activeTagIds.has(node.tagId)) {
        return true;
      }
      if (hoveredNode && node.id !== hoveredNode.id) {
        const neighbors = neighborsByNodeId.get(hoveredNode.id);
        if (!neighbors?.has(node.id)) return true;
      }
      return false;
    },
    [activeTagIds, matchingRaindropIds, hoveredNode, neighborsByNodeId]
  );

  const isLinkHighlighted = useCallback(
    (link: TagNetworkLink): boolean => {
      if (!hoveredNode) return false;
      return linksByNodeId.get(hoveredNode.id)?.has(link) ?? false;
    },
    [hoveredNode, linksByNodeId]
  );

  const nodeCanvasObject = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as unknown as TagNetworkNode & { x?: number; y?: number };
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      const dimmed = isNodeDimmed(n);
      const isHovered = n.id === hoveredNode?.id;

      if (n.kind === "tag") {
        ctx.globalAlpha = dimmed ? 0.25 : 1;
        ctx.fillStyle = isHovered ? "#fff" : n.color;
        ctx.beginPath();
        ctx.arc(x, y, n.radius, 0, Math.PI * 2);
        ctx.fill();

        if (isHovered || globalScale > 2) {
          ctx.globalAlpha = dimmed ? 0.4 : 1;
          ctx.fillStyle = "#fff";
          ctx.font = `${12 / globalScale}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(n.name, x, y - n.radius - 4 / globalScale);
        }
      } else {
        ctx.globalAlpha = dimmed ? 0.15 : 0.85;
        ctx.fillStyle = isHovered ? "#fff" : "#a3a3a3";
        ctx.beginPath();
        ctx.arc(x, y, isHovered ? RAINDROP_DOT_RADIUS + 1.5 : RAINDROP_DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    [hoveredNode, isNodeDimmed]
  );

  const linkWidth = useCallback(
    (link: FGLink) => {
      const l = link as unknown as TagNetworkLink;
      if (l.kind === "membership") return MEMBERSHIP_LINK_WIDTH;
      const base = linkWidthScale(l.weight);
      return isLinkHighlighted(l) ? base + 2 : base;
    },
    [linkWidthScale, isLinkHighlighted]
  );

  const linkColor = useCallback(
    (link: FGLink) => {
      const l = link as unknown as TagNetworkLink;
      if (l.kind === "membership") {
        return isLinkHighlighted(l) ? "rgba(255,255,255,0.6)" : `rgba(255,255,255,${MEMBERSHIP_LINK_OPACITY})`;
      }
      return isLinkHighlighted(l) ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)";
    },
    [isLinkHighlighted]
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
