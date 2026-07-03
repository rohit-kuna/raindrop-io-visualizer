import { scaleLinear, scaleSqrt } from "d3-scale";
import { interpolateRainbow } from "d3-scale-chromatic";
import type { GraphData } from "@/lib/types";

export const RAINDROP_DOT_RADIUS = 3;
const MIN_TAG_NODE_RADIUS = 8;
const MAX_TAG_NODE_RADIUS = 40;
const MIN_LINK_WIDTH = 0.5;
const MAX_LINK_WIDTH = 6;
export const MEMBERSHIP_LINK_WIDTH = 0.4;
export const MEMBERSHIP_LINK_OPACITY = 0.08;

export type TagNode = {
  id: string;
  kind: "tag";
  tagId: number;
  name: string;
  count: number;
  radius: number;
  color: string;
  val: number;
};

export type RaindropNode = {
  id: string;
  kind: "raindrop";
  raindropId: number;
  title: string;
  link: string;
  domain: string | null;
  cover: string | null;
  excerpt: string | null;
  createdAt: string;
  collectionId: number | null;
  tagIds: number[];
  val: number;
};

export type TagNetworkNode = TagNode | RaindropNode;

export type CooccurrenceLink = { source: string; target: string; kind: "cooccurrence"; weight: number };
export type MembershipLink = { source: string; target: string; kind: "membership" };
export type TagNetworkLink = CooccurrenceLink | MembershipLink;

export type TagNetworkData = { nodes: TagNetworkNode[]; links: TagNetworkLink[] };

export function tagNodeId(tagId: number): string {
  return `tag:${tagId}`;
}

export function raindropNodeId(raindropId: number): string {
  return `raindrop:${raindropId}`;
}

export function computeTagNetwork(data: GraphData): TagNetworkData {
  const maxCount = Math.max(1, ...data.tags.map((t) => t.count));
  const radiusScale = scaleSqrt().domain([0, maxCount]).range([MIN_TAG_NODE_RADIUS, MAX_TAG_NODE_RADIUS]);
  const tagCount = Math.max(1, data.tags.length);

  const tagNodes: TagNode[] = data.tags.map((tag, i) => ({
    id: tagNodeId(tag.id),
    kind: "tag",
    tagId: tag.id,
    name: tag.name,
    count: tag.count,
    radius: radiusScale(tag.count),
    color: interpolateRainbow(i / tagCount),
    val: radiusScale(tag.count),
  }));

  const raindropNodes: RaindropNode[] = data.raindrops.map((r) => ({
    id: raindropNodeId(r.id),
    kind: "raindrop",
    raindropId: r.id,
    title: r.title,
    link: r.link,
    domain: r.domain,
    cover: r.cover,
    excerpt: r.excerpt,
    createdAt: r.createdAt,
    collectionId: r.collectionId,
    tagIds: r.tagIds,
    val: RAINDROP_DOT_RADIUS,
  }));

  const pairCounts = new Map<string, number>();
  const membershipLinks: MembershipLink[] = [];

  for (const r of data.raindrops) {
    const ids = r.tagIds;
    for (let i = 0; i < ids.length; i++) {
      membershipLinks.push({ source: raindropNodeId(r.id), target: tagNodeId(ids[i]), kind: "membership" });
      for (let j = i + 1; j < ids.length; j++) {
        const a = Math.min(ids[i], ids[j]);
        const b = Math.max(ids[i], ids[j]);
        const key = `${a}-${b}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const cooccurrenceLinks: CooccurrenceLink[] = [...pairCounts.entries()].map(([key, weight]) => {
    const [a, b] = key.split("-").map(Number);
    return { source: tagNodeId(a), target: tagNodeId(b), kind: "cooccurrence", weight };
  });

  return {
    nodes: [...tagNodes, ...raindropNodes],
    links: [...cooccurrenceLinks, ...membershipLinks],
  };
}

export function makeLinkWidthScale(links: CooccurrenceLink[]) {
  const maxWeight = Math.max(1, ...links.map((l) => l.weight));
  return scaleLinear().domain([1, maxWeight]).range([MIN_LINK_WIDTH, MAX_LINK_WIDTH]).clamp(true);
}

export function buildNeighborIndex(data: TagNetworkData) {
  const neighborsByNodeId = new Map<string, Set<string>>();
  const linksByNodeId = new Map<string, Set<TagNetworkLink>>();

  for (const node of data.nodes) {
    neighborsByNodeId.set(node.id, new Set());
    linksByNodeId.set(node.id, new Set());
  }

  for (const link of data.links) {
    const sourceId = typeof link.source === "string" ? link.source : (link.source as TagNetworkNode).id;
    const targetId = typeof link.target === "string" ? link.target : (link.target as TagNetworkNode).id;
    neighborsByNodeId.get(sourceId)?.add(targetId);
    neighborsByNodeId.get(targetId)?.add(sourceId);
    linksByNodeId.get(sourceId)?.add(link);
    linksByNodeId.get(targetId)?.add(link);
  }

  return { neighborsByNodeId, linksByNodeId };
}
