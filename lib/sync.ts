import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { collections, raindropTags, raindrops, tags } from "@/db/schema";
import { fetchAllRaindrops, fetchCollections } from "@/lib/raindrop-client";

const CHUNK_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export type SyncResult = {
  totalRaindrops: number;
  totalTags: number;
  durationMs: number;
};

export async function runSync(userId: number, token: string): Promise<SyncResult> {
  const start = Date.now();

  const [remoteCollections, rawRaindrops] = await Promise.all([
    fetchCollections(token),
    fetchAllRaindrops(token),
  ]);

  // Pagination can overlap if items shift between pages mid-sync; dedupe defensively
  // since ON CONFLICT DO UPDATE can't affect the same row twice within one INSERT.
  const remoteRaindrops = [...new Map(rawRaindrops.map((r) => [r._id, r])).values()];

  // 1. Upsert collections, build raindropCollectionId -> local id map
  const collectionIdMap = new Map<number, number>();
  for (const batch of chunk(remoteCollections, CHUNK_SIZE)) {
    if (batch.length === 0) continue;
    const rows = await db
      .insert(collections)
      .values(
        batch.map((c) => ({
          userId,
          raindropCollectionId: c._id,
          title: c.title,
        }))
      )
      .onConflictDoUpdate({
        target: [collections.userId, collections.raindropCollectionId],
        set: { title: sql`excluded.title`, updatedAt: sql`now()` },
      })
      .returning({ id: collections.id, raindropCollectionId: collections.raindropCollectionId });

    for (const row of rows) {
      collectionIdMap.set(row.raindropCollectionId, row.id);
    }
  }

  // 2. Upsert tags, build name -> local id map
  const uniqueTagNames = [...new Set(remoteRaindrops.flatMap((r) => r.tags ?? []))];
  for (const batch of chunk(uniqueTagNames, CHUNK_SIZE)) {
    if (batch.length === 0) continue;
    await db
      .insert(tags)
      .values(batch.map((name) => ({ userId, name })))
      .onConflictDoNothing({ target: [tags.userId, tags.name] });
  }

  const userTags = await db.select().from(tags).where(eq(tags.userId, userId));
  const tagIdMap = new Map(userTags.map((t) => [t.name, t.id]));

  // 3. Upsert raindrops, build raindropId -> local id map
  const raindropIdMap = new Map<number, number>();
  const seenRaindropIds: number[] = [];
  for (const batch of chunk(remoteRaindrops, CHUNK_SIZE)) {
    if (batch.length === 0) continue;
    const rows = await db
      .insert(raindrops)
      .values(
        batch.map((r) => ({
          userId,
          raindropId: r._id,
          title: r.title,
          link: r.link,
          excerpt: r.excerpt || null,
          domain: r.domain || null,
          cover: r.cover || null,
          type: r.type || null,
          collectionId: collectionIdMap.get(r.collection.$id) ?? null,
          createdAt: new Date(r.created),
          lastUpdate: new Date(r.lastUpdate),
          syncedAt: new Date(),
        }))
      )
      .onConflictDoUpdate({
        target: [raindrops.userId, raindrops.raindropId],
        set: {
          title: sql`excluded.title`,
          link: sql`excluded.link`,
          excerpt: sql`excluded.excerpt`,
          domain: sql`excluded.domain`,
          cover: sql`excluded.cover`,
          type: sql`excluded.type`,
          collectionId: sql`excluded.collection_id`,
          lastUpdate: sql`excluded.last_update`,
          syncedAt: sql`excluded.synced_at`,
        },
      })
      .returning({ id: raindrops.id, raindropId: raindrops.raindropId });

    for (const row of rows) {
      raindropIdMap.set(row.raindropId, row.id);
      seenRaindropIds.push(row.raindropId);
    }
  }

  // 4. Delete raindrops no longer present in this sync pass (cascades raindrop_tags)
  if (seenRaindropIds.length > 0) {
    await db
      .delete(raindrops)
      .where(and(eq(raindrops.userId, userId), notInArray(raindrops.raindropId, seenRaindropIds)));
  } else {
    await db.delete(raindrops).where(eq(raindrops.userId, userId));
  }

  // 5. Rebuild raindrop_tags from scratch for this user
  await db.delete(raindropTags).where(eq(raindropTags.userId, userId));

  const joinRows = remoteRaindrops.flatMap((r) => {
    const localRaindropId = raindropIdMap.get(r._id);
    if (!localRaindropId) return [];
    return (r.tags ?? [])
      .map((tagName) => tagIdMap.get(tagName))
      .filter((tagId): tagId is number => tagId !== undefined)
      .map((tagId) => ({ raindropId: localRaindropId, tagId, userId }));
  });

  for (const batch of chunk(joinRows, CHUNK_SIZE)) {
    if (batch.length === 0) continue;
    await db.insert(raindropTags).values(batch).onConflictDoNothing();
  }

  return {
    totalRaindrops: seenRaindropIds.length,
    totalTags: uniqueTagNames.length,
    durationMs: Date.now() - start,
  };
}
