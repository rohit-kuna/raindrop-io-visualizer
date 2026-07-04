import {
  computeTagNetwork,
  tagNodeId,
  raindropNodeId,
  RAINDROP_DOT_RADIUS,
  type TagNode,
  type CooccurrenceLink,
} from "./tagNetwork";
import type { GraphData, GraphRaindrop } from "@/lib/types";

export const MIN_ORBIT_RADIUS = 20;
export const ORBIT_RADIUS_STEP = 14;
export const PLANETS_PER_RING = 8;
export const BASE_ANGULAR_SPEED = 0.15; // radians/sec at ring 0
export const ANGULAR_SPEED_DECAY = 0.85; // multiplier per ring (outer rings orbit slower)
export const CROSS_LINK_OPACITY = 0.08;
export const CROSS_LINK_WIDTH = 0.4;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5°, avoids repeating angles across rings

export type SunNode = Omit<TagNode, "kind"> & { kind: "sun" };

export type PlanetNode = {
  id: string;
  kind: "planet";
  raindropId: number;
  title: string;
  link: string;
  domain: string | null;
  cover: string | null;
  excerpt: string | null;
  createdAt: string;
  collectionId: number | null;
  tagIds: number[];
  homeSunId: string;
  homeTagId: number;
  otherTagIds: number[];
  orbitRadius: number;
  orbitAngle0: number;
  angularSpeed: number;
  planetSeed: number;
  val: number;
};

export type SolarSystemNode = SunNode | PlanetNode;

export type SolarLink =
  | { source: string; target: string; kind: "cooccurrence"; weight: number }
  | { source: string; target: string; kind: "cross-tag" };

export type SolarSystemData = { nodes: SolarSystemNode[]; links: SolarLink[] };

export function computeSolarSystem(data: GraphData): SolarSystemData {
  const network = computeTagNetwork(data);
  const tagNodesById = new Map(
    network.nodes.filter((n): n is TagNode => n.kind === "tag").map((n) => [n.id, n])
  );
  const cooccurrenceLinks: SolarLink[] = network.links.filter(
    (l): l is CooccurrenceLink => l.kind === "cooccurrence"
  );

  const suns: SunNode[] = [...tagNodesById.values()].map((t) => ({ ...t, kind: "sun" as const }));

  const tagById = new Map(data.tags.map((t) => [t.id, t]));

  function chooseHomeTagId(tagIds: number[]): number | null {
    if (tagIds.length === 0) return null;
    let best = tagIds[0];
    for (const id of tagIds) {
      const bestTag = tagById.get(best);
      const candidate = tagById.get(id);
      if (!candidate) continue;
      if (!bestTag || candidate.count > bestTag.count || (candidate.count === bestTag.count && id < best)) {
        best = id;
      }
    }
    return best;
  }

  const raindropsWithHome = data.raindrops
    .map((r) => ({ r, homeTagId: chooseHomeTagId(r.tagIds) }))
    .filter((x): x is { r: GraphRaindrop; homeTagId: number } => x.homeTagId !== null);

  raindropsWithHome.sort((a, b) => a.r.id - b.r.id);

  const siblingsByHomeSunId = new Map<string, { r: GraphRaindrop; homeTagId: number }[]>();
  for (const entry of raindropsWithHome) {
    const key = tagNodeId(entry.homeTagId);
    const list = siblingsByHomeSunId.get(key) ?? [];
    list.push(entry);
    siblingsByHomeSunId.set(key, list);
  }

  const planets: PlanetNode[] = [];
  const crossLinks: SolarLink[] = [];

  for (const [homeSunId, siblings] of siblingsByHomeSunId) {
    const homeSun = tagNodesById.get(homeSunId);
    if (!homeSun) continue;

    siblings.forEach(({ r, homeTagId }, index) => {
      const ring = Math.floor(index / PLANETS_PER_RING);

      const orbitRadius = homeSun.radius + MIN_ORBIT_RADIUS + ring * ORBIT_RADIUS_STEP;
      // Golden-angle spacing (rather than a fixed slot/PLANETS_PER_RING angle) so successive
      // rings don't all reuse the same handful of angles — that produced radial "spokes" of
      // planets stacked at just a few directions, which could visually pass through other
      // suns entirely and look like planets had escaped their own ring.
      const orbitAngle0 = (index * GOLDEN_ANGLE) % (Math.PI * 2);
      const angularSpeed = BASE_ANGULAR_SPEED * Math.pow(ANGULAR_SPEED_DECAY, ring);

      const planetId = raindropNodeId(r.id);
      const otherTagIds = r.tagIds.filter((id) => id !== homeTagId);

      planets.push({
        id: planetId,
        kind: "planet",
        raindropId: r.id,
        title: r.title,
        link: r.link,
        domain: r.domain,
        cover: r.cover,
        excerpt: r.excerpt,
        createdAt: r.createdAt,
        collectionId: r.collectionId,
        tagIds: r.tagIds,
        homeSunId,
        homeTagId,
        otherTagIds,
        orbitRadius,
        orbitAngle0,
        angularSpeed,
        planetSeed: r.id,
        val: RAINDROP_DOT_RADIUS,
      });

      for (const otherTagId of otherTagIds) {
        const otherSunId = tagNodeId(otherTagId);
        if (tagNodesById.has(otherSunId)) {
          crossLinks.push({ source: planetId, target: otherSunId, kind: "cross-tag" });
        }
      }
    });
  }

  return {
    nodes: [...suns, ...planets],
    links: [...cooccurrenceLinks, ...crossLinks],
  };
}

export function makeOrbitAngle(planet: PlanetNode, elapsedSeconds: number): number {
  return (
    planet.orbitAngle0 +
    planet.angularSpeed * elapsedSeconds +
    0.05 * Math.sin(planet.planetSeed + elapsedSeconds * 0.3)
  );
}

export function makeOrbitRadius(planet: PlanetNode, elapsedSeconds: number): number {
  return planet.orbitRadius + 2 * Math.sin(planet.planetSeed * 1.7 + elapsedSeconds * 0.5);
}
