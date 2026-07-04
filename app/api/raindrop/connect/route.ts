import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/app/lib/auth";
import { getAuthorizeUrl } from "@/lib/raindrop-oauth";

const STATE_COOKIE = "raindrop_oauth_state";

export async function GET() {
  await requireUser();

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(getAuthorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
