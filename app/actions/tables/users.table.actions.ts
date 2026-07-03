"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

type UpdateUserInput = Partial<{
  email: string;
  raindropToken: string | null;
}>;

export async function getUserById(id: number) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export async function getUserByClerkUserId(clerkUserId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  return user ?? null;
}

export async function updateUserById(id: number, input: UpdateUserInput) {
  const [updatedUser] = await db
    .update(users)
    .set(input)
    .where(eq(users.id, id))
    .returning();

  return updatedUser ?? null;
}
