"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { forceCollide, forceManyBody } from "d3-force";
import type ForceGraph2DComponent from "react-force-graph-2d";
import type { ForceGraphMethods, NodeObject, LinkObject } from "react-force-graph-2d";
import {
  computeSolarSystem,
  makeOrbitAngle,
  makeOrbitRadius,
  CROSS_LINK_WIDTH,
  CROSS_LINK_OPACITY,
  type SolarSystemNode,
  type SolarLink,
  type PlanetNode,
  type SunNode,
} from "@/lib/layout/solarSystem";
import { buildNeighborIndex, makeLinkWidthScale, RAINDROP_DOT_RADIUS } from "@/lib/layout/tagNetwork";
import type { GraphData, PositionedRaindrop } from "@/lib/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
}) as unknown as typeof ForceGraph2DComponent;

const VELOCITY_DECAY = 0.3; // must match the d3VelocityDecay prop passed to ForceGraph2D below

type FGNode = NodeObject<SolarSystemNode>;
type FGLink = LinkObject<SolarSystemNode, SolarLink>;
type PositionedFGNode = { x?: number; y?: number; vx?: number; vy?: number };

export type SolarSystemGraphProps = {
  data: GraphData;
  activeTagIds: Set<number> | null;
  matchingRaindropIds: Set<number> | null;
  onHoverRaindrop: (raindrop: PositionedRaindrop | null, screenX: number, screenY: number) => void;
  onHoverTag: (tagId: number | null) => void;
  onToggleTagFilter: (tagId: number) => void;
};

function isSun(n: SolarSystemNode): n is SunNode {
  return n.kind === "sun";
}

function isPlanet(n: SolarSystemNode): n is PlanetNode {
  return n.kind === "planet";
}

function isCooccurrence(l: SolarLink): l is Extract<SolarLink, { kind: "cooccurrence" }> {
  return l.kind === "cooccurrence";
}

function toPositionedRaindrop(node: PlanetNode & PositionedFGNode): PositionedRaindrop {
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

export function SolarSystemGraph({
  data,
  activeTagIds,
  matchingRaindropIds,
  onHoverRaindrop,
  onHoverTag,
  onToggleTagFilter,
}: SolarSystemGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<SolarSystemNode, SolarLink> | undefined>(undefined);
  const [hoveredNode, setHoveredNode] = useState<SolarSystemNode | null>(null);

  const solar = useMemo(() => computeSolarSystem(data), [data]);
  const { neighborsByNodeId, linksByNodeId } = useMemo(() => buildNeighborIndex(solar), [solar]);
  const sunById = useMemo(() => new Map(solar.nodes.filter(isSun).map((s) => [s.id, s])), [solar]);
  const sunLinkWidthScale = useMemo(() => {
    const cooccurrenceLinks = solar.links.filter(isCooccurrence);
    return makeLinkWidthScale(cooccurrenceLinks);
  }, [solar.links]);

  useEffect(() => {
    // ForceGraph2D is a next/dynamic (ssr:false) component, so it can still be mounting
    // asynchronously on this first effect run — the deps below ([solar, sunById]) never
    // change again for a given `data`, so if we bailed out here permanently, the custom
    // forces (in particular "orbit") would never get registered and the simulation would
    // silently run on bare d3-force defaults forever. Retry each frame until the ref lands.
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
        forceManyBody<FGNode>().strength((n) => (isSun(n as unknown as SolarSystemNode) ? -450 : 0))
      );
      fg.d3Force(
        "collide",
        forceCollide<FGNode>((n) => {
          const node = n as unknown as SolarSystemNode;
          return isSun(node) ? node.radius + 30 : 0;
        })
      );
      const linkForce = fg.d3Force("link");
      if (linkForce) {
        linkForce
          .distance((l: unknown) => ((l as SolarLink).kind === "cross-tag" ? 40 : 150))
          .strength((l: unknown) => {
            const link = l as SolarLink;
            return link.kind === "cooccurrence" ? Math.min(0.6, link.weight / 15) : 0;
          });
      }

      const startTime = performance.now();

      fg.d3Force("gravity", () => {
        const suns = [...sunById.values()] as unknown as PositionedFGNode[];
        if (suns.length === 0) return;
        let cx = 0;
        let cy = 0;
        for (const s of suns) {
          cx += s.x ?? 0;
          cy += s.y ?? 0;
        }
        cx /= suns.length;
        cy /= suns.length;
        for (const s of suns) {
          s.vx = (s.vx ?? 0) + (cx - (s.x ?? 0)) * 0.0006;
          s.vy = (s.vy ?? 0) + (cy - (s.y ?? 0)) * 0.0006;
        }
      });

      // Runs last: finalizes each sun's position for this tick (rather than waiting for the
      // engine's own post-tick integration) so planets always orbit their sun's up-to-date
      // location instead of lagging one tick behind — otherwise a continuously drifting sun
      // (from gravity/charge) visibly separates from its own orbit rings.
      fg.d3Force("orbit", () => {
        const elapsedSeconds = (performance.now() - startTime) / 1000;
        for (const sun of sunById.values()) {
          const s = sun as unknown as PositionedFGNode & { fx?: number | null; fy?: number | null };
          if (s.fx != null || s.fy != null) continue; // being dragged: let the engine apply fx/fy as-is
          const vx = (s.vx ?? 0) * VELOCITY_DECAY;
          const vy = (s.vy ?? 0) * VELOCITY_DECAY;
          s.x = (s.x ?? 0) + vx;
          s.y = (s.y ?? 0) + vy;
          s.vx = 0;
          s.vy = 0;
        }
        for (const node of solar.nodes) {
          if (!isPlanet(node)) continue;
          const sun = sunById.get(node.homeSunId) as (SunNode & PositionedFGNode) | undefined;
          if (!sun) continue;
          const angle = makeOrbitAngle(node, elapsedSeconds);
          const radius = makeOrbitRadius(node, elapsedSeconds);
          const fgn = node as unknown as PositionedFGNode;
          fgn.x = (sun.x ?? 0) + radius * Math.cos(angle);
          fgn.y = (sun.y ?? 0) + radius * Math.sin(angle);
          fgn.vx = 0;
          fgn.vy = 0;
        }
      });

      fg.d3ReheatSimulation();
    }

    setupForces();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [solar, sunById]);

  const isNodeDimmed = useCallback(
    (node: SolarSystemNode): boolean => {
      if (node.kind === "planet" && matchingRaindropIds !== null && !matchingRaindropIds.has(node.raindropId)) {
        return true;
      }
      if (node.kind === "sun" && activeTagIds !== null && activeTagIds.size > 0 && !activeTagIds.has(node.tagId)) {
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
    (link: SolarLink): boolean => {
      if (!hoveredNode) return false;
      return linksByNodeId.get(hoveredNode.id)?.has(link) ?? false;
    },
    [hoveredNode, linksByNodeId]
  );

  const nodeCanvasObject = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as unknown as SolarSystemNode & PositionedFGNode;
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      const dimmed = isNodeDimmed(n);
      const isHovered = n.id === hoveredNode?.id;

      if (isSun(n)) {
        ctx.globalAlpha = dimmed ? 0.2 : 0.5;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, n.radius * 1.8);
        glow.addColorStop(0, isHovered ? "#fff" : n.color);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, n.radius * 1.8, 0, Math.PI * 2);
        ctx.fill();

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
          ctx.fillText(n.name, x, y - n.radius - 6 / globalScale);
        }
      } else {
        const sun = sunById.get(n.homeSunId) as (SunNode & PositionedFGNode) | undefined;
        if (sun) {
          ctx.globalAlpha = dimmed ? 0.04 : 0.12;
          ctx.strokeStyle = "rgba(255,255,255,1)";
          ctx.lineWidth = 1 / globalScale;
          ctx.beginPath();
          ctx.arc(sun.x ?? 0, sun.y ?? 0, n.orbitRadius, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.globalAlpha = dimmed ? 0.15 : 0.85;
        ctx.fillStyle = isHovered ? "#fff" : "#a3a3a3";
        ctx.beginPath();
        ctx.arc(x, y, isHovered ? RAINDROP_DOT_RADIUS + 1.5 : RAINDROP_DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    [hoveredNode, isNodeDimmed, sunById]
  );

  const linkWidth = useCallback(
    (link: FGLink) => {
      const l = link as unknown as SolarLink;
      if (l.kind === "cross-tag") return CROSS_LINK_WIDTH;
      const base = sunLinkWidthScale(l.weight);
      return isLinkHighlighted(l) ? base + 2 : base;
    },
    [sunLinkWidthScale, isLinkHighlighted]
  );

  const linkColor = useCallback(
    (link: FGLink) => {
      const l = link as unknown as SolarLink;
      if (l.kind === "cross-tag") {
        return isLinkHighlighted(l) ? "rgba(255,255,255,0.6)" : `rgba(255,255,255,${CROSS_LINK_OPACITY})`;
      }
      return isLinkHighlighted(l) ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)";
    },
    [isLinkHighlighted]
  );

  const handleNodeHover = useCallback(
    (node: FGNode | null) => {
      const n = node as unknown as (SolarSystemNode & PositionedFGNode) | null;
      setHoveredNode(n);

      if (!n) {
        onHoverRaindrop(null, 0, 0);
        onHoverTag(null);
        return;
      }

      if (n.kind === "planet") {
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
      const n = node as unknown as SolarSystemNode;
      if (n.kind === "sun") {
        onToggleTagFilter(n.tagId);
      } else {
        window.open(n.link, "_blank", "noopener,noreferrer");
      }
    },
    [onToggleTagFilter]
  );

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <ForceGraph2D<SolarSystemNode, SolarLink>
        ref={fgRef}
        graphData={solar as unknown as { nodes: FGNode[]; links: FGLink[] }}
        nodeId="id"
        nodeVal="val"
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => "replace"}
        linkWidth={linkWidth}
        linkColor={linkColor}
        linkDirectionalParticles={0}
        cooldownTime={Infinity}
        d3AlphaDecay={0.005}
        d3VelocityDecay={VELOCITY_DECAY}
        warmupTicks={100}
        enableNodeDrag={true}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
}
