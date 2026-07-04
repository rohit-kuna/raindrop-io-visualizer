"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
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
import {
  buildNeighborIndex,
  makeLinkWidthScale,
  tagNodeId,
  RAINDROP_DOT_RADIUS,
} from "@/lib/layout/tagNetwork";
import type { GraphData, PositionedRaindrop } from "@/lib/types";
import { useContainerSize } from "@/lib/hooks/useContainerSize";
import { fitCircleLabelFontSize } from "@/lib/canvas/fitCircleLabel";

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
  matchingTagIds: Set<number> | null;
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
  matchingTagIds,
  onHoverRaindrop,
  onHoverTag,
  onToggleTagFilter,
}: SolarSystemGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<SolarSystemNode, SolarLink> | undefined>(undefined);
  const [hoveredNode, setHoveredNode] = useState<SolarSystemNode | null>(null);
  const { width, height } = useContainerSize(containerRef);
  const { resolvedTheme } = useTheme();
  // The canvas background follows the page theme, so link/orbit lines need to flip too — white
  // lines are invisible against the light-mode background.
  const lineRgb = resolvedTheme === "light" ? "0,0,0" : "255,255,255";
  // Hovered nodes get a solid highlight fill — white reads fine on the dark canvas but
  // disappears on light-mode's light background, so flip to near-black there. The label color
  // then flips opposite so the tag name stays readable against whichever fill is used.
  const hoverFillColor = resolvedTheme === "light" ? "#111111" : "#ffffff";
  const hoverLabelColor = resolvedTheme === "light" ? "#ffffff" : "#111111";

  const solar = useMemo(() => computeSolarSystem(data), [data]);
  const { neighborsByNodeId, linksByNodeId } = useMemo(() => buildNeighborIndex(solar), [solar]);
  const sunById = useMemo(() => new Map(solar.nodes.filter(isSun).map((s) => [s.id, s])), [solar]);
  const sunLinkWidthScale = useMemo(() => {
    const cooccurrenceLinks = solar.links.filter(isCooccurrence);
    return makeLinkWidthScale(cooccurrenceLinks);
  }, [solar.links]);

  // When one or more tags are selected, their suns and own orbiting planets are "in focus" (full
  // opacity) — planets only ever link to *other* tags they also carry (cross-tag), not to their
  // own home sun, so this relevance comes from homeSunId/tagIds directly rather than the
  // link-based neighbor index. Suns one hop away (via a cooccurrence link, or via a cross-tag
  // link from one of the selected tag's own planets) are shown as subtly-related, along with the
  // connecting link. Everything further out fades to a faint ghost.
  const selectedSunIds = useMemo(() => {
    if (!activeTagIds || activeTagIds.size === 0) return null;
    return new Set([...activeTagIds].map(tagNodeId));
  }, [activeTagIds]);

  // The force-simulation callbacks below are registered once (effect deps: [solar, sunById]) and
  // read this ref every tick rather than closing over `selectedSunIds` directly, so a selection
  // change doesn't need to re-run the whole force setup — it just freezes/thaws motion in place.
  const hasSelectionRef = useRef(false);
  useEffect(() => {
    hasSelectionRef.current = selectedSunIds !== null;
  }, [selectedSunIds]);

  const selectionRelevantNodeIds = useMemo(() => {
    if (!selectedSunIds) return null;
    const ids = new Set<string>(selectedSunIds);
    for (const node of solar.nodes) {
      if (node.kind === "planet" && selectedSunIds.has(node.homeSunId)) {
        ids.add(node.id);
      }
    }
    return ids;
  }, [selectedSunIds, solar.nodes]);

  const selectionRelatedSunIds = useMemo(() => {
    if (!selectedSunIds || !selectionRelevantNodeIds) return null;
    const relatedSunIds = new Set<string>();

    for (const nodeId of selectionRelevantNodeIds) {
      const links = linksByNodeId.get(nodeId);
      if (!links) continue;
      for (const link of links) {
        const sourceId = typeof link.source === "string" ? link.source : (link.source as { id: string }).id;
        const targetId = typeof link.target === "string" ? link.target : (link.target as { id: string }).id;
        const otherId = sourceId === nodeId ? targetId : sourceId;
        if (sunById.has(otherId) && !selectedSunIds.has(otherId)) {
          relatedSunIds.add(otherId);
        }
      }
    }
    return relatedSunIds;
  }, [selectedSunIds, selectionRelevantNodeIds, linksByNodeId, sunById]);

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
        if (hasSelectionRef.current) return; // frozen while a tag is selected
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
      // (from gravity/charge) visibly separates from its own orbit rings. While a tag is
      // selected, motion freezes entirely (suns hold still, planets stop orbiting) so the
      // focused view reads as a calm snapshot instead of a continuously drifting scene.
      fg.d3Force("orbit", () => {
        const selectionActive = hasSelectionRef.current;
        const elapsedSeconds = (performance.now() - startTime) / 1000;
        for (const sun of sunById.values()) {
          const s = sun as unknown as PositionedFGNode & { fx?: number | null; fy?: number | null };
          if (s.fx != null || s.fy != null) continue; // being dragged: let the engine apply fx/fy as-is
          if (selectionActive) {
            s.vx = 0;
            s.vy = 0;
            continue;
          }
          const vx = (s.vx ?? 0) * VELOCITY_DECAY;
          const vy = (s.vy ?? 0) * VELOCITY_DECAY;
          s.x = (s.x ?? 0) + vx;
          s.y = (s.y ?? 0) + vy;
          s.vx = 0;
          s.vy = 0;
        }
        for (const node of solar.nodes) {
          if (!isPlanet(node)) continue;
          const fgn = node as unknown as PositionedFGNode;
          if (selectionActive) {
            fgn.vx = 0;
            fgn.vy = 0;
            continue;
          }
          const sun = sunById.get(node.homeSunId) as (SunNode & PositionedFGNode) | undefined;
          if (!sun) continue;
          const angle = makeOrbitAngle(node, elapsedSeconds);
          const radius = makeOrbitRadius(node, elapsedSeconds);
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

  const isNodeRelated = useCallback(
    (node: SolarSystemNode): boolean => {
      return node.kind === "sun" && (selectionRelatedSunIds?.has(node.id) ?? false);
    },
    [selectionRelatedSunIds]
  );

  const isNodeDimmed = useCallback(
    (node: SolarSystemNode): boolean => {
      if (node.kind === "planet" && matchingRaindropIds !== null && !matchingRaindropIds.has(node.raindropId)) {
        return true;
      }
      if (node.kind === "sun" && matchingTagIds !== null && !matchingTagIds.has(node.tagId)) {
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
  // matching — a cross-tag link needs its planet's raindrop in matchingRaindropIds AND the other
  // sun's tag in matchingTagIds; a cooccurrence link needs both suns' tags in matchingTagIds.
  const isLinkMatchingSearch = useCallback(
    (link: SolarLink): boolean => {
      if (matchingRaindropIds === null && matchingTagIds === null) return true;
      const sourceId = typeof link.source === "string" ? link.source : (link.source as { id: string }).id;
      const targetId = typeof link.target === "string" ? link.target : (link.target as { id: string }).id;
      if (link.kind === "cross-tag") {
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

  // Any tag selection fully fades every link — related tags are shown as subtly-highlighted suns
  // (isNodeRelated) without their connecting lines, to keep the focused view uncluttered.
  const isLinkDimmed = useCallback(() => selectedSunIds !== null, [selectedSunIds]);

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
      const related = isNodeRelated(n);
      const isHovered = n.id === hoveredNode?.id;

      if (isSun(n)) {
        ctx.globalAlpha = dimmed ? 0.06 : related ? 0.3 : 0.5;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, n.radius * 1.8);
        glow.addColorStop(0, isHovered ? hoverFillColor : n.color);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, n.radius * 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = dimmed ? 0.08 : related ? 0.4 : 1;
        ctx.fillStyle = isHovered ? hoverFillColor : n.color;
        ctx.beginPath();
        ctx.arc(x, y, n.radius, 0, Math.PI * 2);
        ctx.fill();

        if (n.radius > 6) {
          const fontSize = fitCircleLabelFontSize(ctx, n.name, n.radius);
          ctx.globalAlpha = dimmed ? 0.15 : related ? 0.5 : 1;
          ctx.fillStyle = isHovered ? hoverLabelColor : "#fff";
          ctx.font = `600 ${fontSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(n.name, x, y, n.radius * 1.7);
        }
      } else {
        const sun = sunById.get(n.homeSunId) as (SunNode & PositionedFGNode) | undefined;
        if (sun) {
          ctx.globalAlpha = dimmed ? 0.015 : 0.12;
          ctx.strokeStyle = `rgba(${lineRgb},1)`;
          ctx.lineWidth = 1 / globalScale;
          ctx.beginPath();
          ctx.arc(sun.x ?? 0, sun.y ?? 0, n.orbitRadius, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.globalAlpha = dimmed ? 0.06 : 0.85;
        ctx.fillStyle = isHovered ? hoverFillColor : "#a3a3a3";
        ctx.beginPath();
        ctx.arc(x, y, isHovered ? RAINDROP_DOT_RADIUS + 1.5 : RAINDROP_DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    [hoveredNode, isNodeDimmed, isNodeRelated, sunById, lineRgb, hoverFillColor, hoverLabelColor]
  );

  const linkWidth = useCallback(
    (link: FGLink) => {
      const l = link as unknown as SolarLink;
      const base = l.kind === "cross-tag" ? CROSS_LINK_WIDTH : sunLinkWidthScale(l.weight);
      if (!isLinkMatchingSearch(l)) return base * 0.4;
      if (isLinkDimmed()) return base * 0.4;
      return isLinkHighlighted(l) ? base + 2 : base;
    },
    [sunLinkWidthScale, isLinkDimmed, isLinkHighlighted, isLinkMatchingSearch]
  );

  const linkColor = useCallback(
    (link: FGLink) => {
      const l = link as unknown as SolarLink;
      if (!isLinkMatchingSearch(l)) return `rgba(${lineRgb},0.02)`;
      if (isLinkDimmed()) return `rgba(${lineRgb},0.02)`;
      if (l.kind === "cross-tag") {
        return isLinkHighlighted(l) ? `rgba(${lineRgb},0.6)` : `rgba(${lineRgb},${CROSS_LINK_OPACITY})`;
      }
      return isLinkHighlighted(l) ? `rgba(${lineRgb},0.9)` : `rgba(${lineRgb},0.35)`;
    },
    [isLinkDimmed, isLinkHighlighted, lineRgb, isLinkMatchingSearch]
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
        width={width}
        height={height}
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
        // `warmupTicks` runs synchronously the instant `graphData` is set, using whatever
        // forces are registered on the engine at that exact moment — which is only the
        // library's bare defaults, since our custom charge/collide/gravity/orbit forces get
        // attached afterward in the effect below (has to wait for the ref to a next/dynamic,
        // ssr:false component). With no "orbit" force yet, that warmup scatters suns/planets
        // with no orbit constraint at all, baking in the clustered/overlapping-rings mess seen
        // on first load. Skipping the warmup here (0) leaves nodes at their fresh initial
        // positions instead; d3ReheatSimulation() + cooldownTime=Infinity below then animate
        // them into the correct layout live, once the real forces are in place.
        warmupTicks={0}
        enableNodeDrag={true}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
}
