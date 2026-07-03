import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/app/lib/auth";
import { db } from "@/db";
import { collections, raindropTags, raindrops, tags } from "@/db/schema";
import type { GraphData } from "@/lib/types";

export async function GET() {
  const user = await requireUser();

  const [userTags, userCollections, userRaindrops, userRaindropTags] = await Promise.all([
    db.select().from(tags).where(eq(tags.userId, user.id)),
    db.select().from(collections).where(eq(collections.userId, user.id)),
    db.select().from(raindrops).where(eq(raindrops.userId, user.id)),
    db.select().from(raindropTags).where(eq(raindropTags.userId, user.id)),
  ]);

  const tagIdsByRaindropId = new Map<number, number[]>();
  const raindropCountByTagId = new Map<number, number>();
  for (const join of userRaindropTags) {
    const list = tagIdsByRaindropId.get(join.raindropId) ?? [];
    list.push(join.tagId);
    tagIdsByRaindropId.set(join.raindropId, list);
    raindropCountByTagId.set(join.tagId, (raindropCountByTagId.get(join.tagId) ?? 0) + 1);
  }

  const data: GraphData = {
    tags: userTags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      count: raindropCountByTagId.get(tag.id) ?? 0,
    })),
    collections: userCollections.map((c) => ({ id: c.id, title: c.title })),
    raindrops: userRaindrops.map((r) => ({
      id: r.id,
      title: r.title,
      link: r.link,
      domain: r.domain,
      cover: r.cover,
      excerpt: r.excerpt,
      createdAt: r.createdAt.toISOString(),
      collectionId: r.collectionId,
      tagIds: tagIdsByRaindropId.get(r.id) ?? [],
    })),
  };

  return NextResponse.json(data);
}
