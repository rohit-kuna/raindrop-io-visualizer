import { NextResponse } from "next/server";
import { requireUser } from "@/app/lib/auth";
import { updateUserById } from "@/app/actions/tables/users.table.actions";
import { encryptToken } from "@/lib/crypto";
import { exchangeCodeForTokens } from "@/lib/raindrop-oauth";
import { ROUTES } from "@/app/lib/constants";

const STATE_COOKIE = "raindrop_oauth_state";

export async function GET(request: Request) {
  const user = await requireUser();

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.headers
    .get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith(`${STATE_COOKIE}=`))
    ?.split("=")[1];

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL(`${ROUTES.SETTINGS}?raindrop_error=1`, url.origin));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await updateUserById(user.id, {
      raindropAccessToken: encryptToken(tokens.accessToken),
      raindropRefreshToken: encryptToken(tokens.refreshToken),
      raindropTokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    });
  } catch (err) {
    console.error("Raindrop OAuth callback failed", err);
    return NextResponse.redirect(new URL(`${ROUTES.SETTINGS}?raindrop_error=1`, url.origin));
  }

  const res = NextResponse.redirect(new URL(ROUTES.SETTINGS, url.origin));
  res.cookies.delete(STATE_COOKIE);
  return res;
}
