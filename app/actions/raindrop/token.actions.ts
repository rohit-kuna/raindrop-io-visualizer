"use server";

import { requireUser } from "@/app/lib/auth";
import { updateUserById } from "@/app/actions/tables/users.table.actions";

export async function disconnectRaindropToken() {
  const user = await requireUser();
  await updateUserById(user.id, {
    raindropAccessToken: null,
    raindropRefreshToken: null,
    raindropTokenExpiresAt: null,
  });
  return { success: true };
}

/**
 * Returns only whether a token is configured — never the token itself.
 */
export async function getRaindropConnectionStatus() {
  const user = await requireUser();
  return { connected: Boolean(user.raindropAccessToken) };
}
