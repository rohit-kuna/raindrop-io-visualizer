import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { syncUserWithDb } from "@/app/lib/user-sync";
import { ROUTES } from "@/app/lib/constants";

/**
 * Returns the application user (DB user). Throws if the DB is unreachable —
 * callers decide how to handle that (see requireUser vs. the landing page,
 * which falls back to showing marketing content instead of erroring).
 */
export async function getCurrentDbUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  // Ensure user exists in DB
  await syncUserWithDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUser.id))
    .limit(1);

  return user ?? null;
}

/**
 * Require authenticated user
 */
export async function requireUser() {
  let user;
  try {
    user = await getCurrentDbUser();
  } catch {
    redirect(ROUTES.SERVICE_UNAVAILABLE);
  }
  if (!user) redirect(ROUTES.SIGN_IN);
  return user;
}
