import { decryptToken, encryptToken } from "@/lib/crypto";
import { refreshAccessToken } from "@/lib/raindrop-oauth";
import { updateUserById } from "@/app/actions/tables/users.table.actions";
import type { users } from "@/db/schema";

type User = typeof users.$inferSelect;

const REFRESH_BUFFER_MS = 60_000;

/**
 * Returns a decrypted, guaranteed-fresh Raindrop access token, refreshing and
 * persisting new tokens first if the stored one is expired or about to expire.
 */
export async function getValidAccessToken(user: User): Promise<string> {
  if (!user.raindropAccessToken || !user.raindropRefreshToken || !user.raindropTokenExpiresAt) {
    throw new Error("User has not connected a Raindrop.io account.");
  }

  const expiresAt = user.raindropTokenExpiresAt.getTime();
  if (expiresAt - REFRESH_BUFFER_MS > Date.now()) {
    return decryptToken(user.raindropAccessToken);
  }

  const refreshToken = decryptToken(user.raindropRefreshToken);
  const tokens = await refreshAccessToken(refreshToken);

  await updateUserById(user.id, {
    raindropAccessToken: encryptToken(tokens.accessToken),
    raindropRefreshToken: encryptToken(tokens.refreshToken),
    raindropTokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
  });

  return tokens.accessToken;
}
