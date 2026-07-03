import { NextResponse } from "next/server";
import { isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { decryptToken } from "@/lib/crypto";
import { runSync } from "@/lib/sync";

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connectedUsers = await db
    .select()
    .from(users)
    .where(isNotNull(users.raindropToken));

  const results = await Promise.allSettled(
    connectedUsers.map(async (user) => {
      const token = decryptToken(user.raindropToken!);
      return runSync(user.id, token);
    })
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - succeeded;

  return NextResponse.json({ totalUsers: results.length, succeeded, failed });
}
