import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/app/lib/auth";
import { db } from "@/db";
import { userGraphs } from "@/db/schema";
import type { GraphData } from "@/lib/types";

const EMPTY_GRAPH: GraphData = { tags: [], collections: [], raindrops: [] };

export async function GET() {
  const user = await requireUser();

  const [row] = await db
    .select({ graphJson: userGraphs.graphJson })
    .from(userGraphs)
    .where(eq(userGraphs.userId, user.id))
    .limit(1);

  return NextResponse.json(row?.graphJson ?? EMPTY_GRAPH);
}
