import { db } from "@/db";
import { userGraphs } from "@/db/schema";
import { fetchAllRaindrops, fetchCollections } from "@/lib/raindrop-client";
import type { GraphCollection, GraphData, GraphRaindrop, GraphTag } from "@/lib/types";

export type SyncResult = {
  totalRaindrops: number;
  totalTags: number;
  durationMs: number;
};

type TagLikeEntry = { source: "tag" | "collection"; name: string; raindropCollectionId?: number };

export async function runSync(userId: number, token: string): Promise<SyncResult> {
  const start = Date.now();

  const [remoteCollections, rawRaindrops] = await Promise.all([
    fetchCollections(token),
    fetchAllRaindrops(token),
  ]);

  // Pagination can overlap if items shift between pages mid-sync; dedupe defensively.
  const remoteRaindrops = [...new Map(rawRaindrops.map((r) => [r._id, r])).values()];

  // Collections behave like tags in the graph too — each collection becomes an
  // additional tag-like node, and every raindrop in it gets that pseudo-tag added
  // to its tagIds. Kept distinct from same-named real tags (no merging) to avoid
  // ambiguous count/identity collisions between the two sources.
  const uniqueTagNames = [...new Set(remoteRaindrops.flatMap((r) => r.tags ?? []))];
  const tagEntries: TagLikeEntry[] = uniqueTagNames.map((name) => ({ source: "tag", name }));
  const collectionEntries: TagLikeEntry[] = remoteCollections.map((c) => ({
    source: "collection",
    name: c.title,
    raindropCollectionId: c._id,
  }));

  const combinedEntries = [...tagEntries, ...collectionEntries].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const tagIdByName = new Map<string, number>();
  const tagIdByRaindropCollectionId = new Map<number, number>();
  combinedEntries.forEach((entry, index) => {
    const id = index + 1;
    if (entry.source === "tag") {
      tagIdByName.set(entry.name, id);
    } else {
      tagIdByRaindropCollectionId.set(entry.raindropCollectionId!, id);
    }
  });

  const raindropCountByTagId = new Map<number, number>();
  const graphRaindrops: GraphRaindrop[] = remoteRaindrops.map((r) => {
    const tagIds = (r.tags ?? []).map((name) => tagIdByName.get(name)!);
    const raindropCollectionId = r.collection?.$id;
    const collectionTagId =
      raindropCollectionId !== undefined ? tagIdByRaindropCollectionId.get(raindropCollectionId) : undefined;
    if (collectionTagId !== undefined) tagIds.push(collectionTagId);

    for (const tagId of tagIds) {
      raindropCountByTagId.set(tagId, (raindropCountByTagId.get(tagId) ?? 0) + 1);
    }

    return {
      id: r._id,
      title: r.title,
      link: r.link,
      domain: r.domain || null,
      cover: r.cover || null,
      excerpt: r.excerpt || null,
      createdAt: new Date(r.created).toISOString(),
      collectionId: r.collection?.$id ?? null,
      tagIds,
    };
  });

  const graphTags: GraphTag[] = combinedEntries.map((entry, index) => ({
    id: index + 1,
    name: entry.name,
    count: raindropCountByTagId.get(index + 1) ?? 0,
  }));

  const graphCollections: GraphCollection[] = remoteCollections.map((c) => ({
    id: c._id,
    title: c.title,
  }));

  const graphData: GraphData = {
    tags: graphTags,
    collections: graphCollections,
    raindrops: graphRaindrops,
  };

  await db
    .insert(userGraphs)
    .values({ userId, graphJson: graphData, lastSync: new Date() })
    .onConflictDoUpdate({
      target: userGraphs.userId,
      set: { graphJson: graphData, lastSync: new Date() },
    });

  return {
    totalRaindrops: graphRaindrops.length,
    totalTags: graphTags.length,
    durationMs: Date.now() - start,
  };
}
