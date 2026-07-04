import { NextResponse } from "next/server";
import { requireUser } from "@/app/lib/auth";
import { getValidAccessToken } from "@/lib/raindrop-tokens";
import { runSync } from "@/lib/sync";

export const maxDuration = 60;

export async function POST() {
  const user = await requireUser();

  if (!user.raindropAccessToken) {
    return NextResponse.json(
      { error: "Connect your Raindrop account in Settings first." },
      { status: 400 }
    );
  }

  try {
    const token = await getValidAccessToken(user);
    const result = await runSync(user.id, token);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Sync failed", err);
    return NextResponse.json({ error: "Sync failed." }, { status: 500 });
  }
}
