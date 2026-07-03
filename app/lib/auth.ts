import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { syncUserWithDb } from "@/app/lib/user-sync";
import { ROUTES } from "@/app/lib/constants";

/**
 * Returns the application user (DB user)
 */
export async function getCurrentDbUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  try {
    // Ensure user exists in DB
    await syncUserWithDb();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUser.id))
      .limit(1);

    return user ?? null;
  } catch {
    redirect(ROUTES.SERVICE_UNAVAILABLE);
  }
}

/**
 * Require authenticated user
 */
export async function requireUser() {
  const user = await getCurrentDbUser();
  if (!user) redirect(ROUTES.SIGN_IN);
  return user;
}
