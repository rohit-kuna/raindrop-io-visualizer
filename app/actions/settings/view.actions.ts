"use server";

import { requireUser } from "@/app/lib/auth";
import { updateUserById } from "@/app/actions/tables/users.table.actions";

export type ViewMode = "network" | "solar";

export async function saveDefaultView(view: ViewMode) {
  if (view !== "network" && view !== "solar") {
    throw new Error("Invalid view.");
  }

  const user = await requireUser();
  await updateUserById(user.id, { defaultView: view });
  return { success: true };
}
