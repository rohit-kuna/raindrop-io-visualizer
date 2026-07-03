"use server";

import { requireUser } from "@/app/lib/auth";
import { updateUserById } from "@/app/actions/tables/users.table.actions";
import { encryptToken } from "@/lib/crypto";

/**
 * Saves the current user's personal Raindrop.io test token, encrypted at rest.
 */
export async function saveRaindropToken(token: string) {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("Token cannot be empty.");
  }

  const user = await requireUser();
  await updateUserById(user.id, { raindropToken: encryptToken(trimmed) });
  return { success: true };
}

export async function disconnectRaindropToken() {
  const user = await requireUser();
  await updateUserById(user.id, { raindropToken: null });
  return { success: true };
}

/**
 * Returns only whether a token is configured — never the token itself.
 */
export async function getRaindropConnectionStatus() {
  const user = await requireUser();
  return { connected: Boolean(user.raindropToken) };
}
