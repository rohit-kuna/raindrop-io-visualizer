import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import type { GraphData } from "@/lib/types";

/**
 * Users table
 * - One row per Clerk user
 * - raindropAccessToken/raindropRefreshToken are OAuth2 tokens from Raindrop.io's
 *   authorization-code flow, AES-256-GCM encrypted at rest (see lib/crypto.ts).
 *   raindropTokenExpiresAt tracks the access token's expiry so it can be
 *   refreshed lazily (see lib/raindrop-tokens.ts). All null until connected.
 */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),

    // Clerk user ID (source of truth)
    clerkUserId: varchar("clerk_user_id", { length: 255 })
      .notNull()
      .unique(),

    email: varchar("email", { length: 255 }).notNull(),

    raindropAccessToken: text("raindrop_access_token"),
    raindropRefreshToken: text("raindrop_refresh_token"),
    raindropTokenExpiresAt: timestamp("raindrop_token_expires_at", { withTimezone: true }),

    defaultView: varchar("default_view", { length: 16 }).default("network").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("users_clerk_user_id_idx").on(table.clerkUserId)]
);

/**
 * User graphs table
 * - One row per user: the fully-precomputed GraphData blob (tags, collections,
 *   raindrops) built at sync time from the Raindrop.io API. Replaces the old
 *   normalized collections/tags/raindrops/raindrop_tags tables entirely — a
 *   sync just replaces this row wholesale rather than diffing individual rows.
 */
export const userGraphs = pgTable("user_graphs", {
  id: serial("id").primaryKey(),

  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),

  graphJson: jsonb("graph_json").$type<GraphData>().notNull(),

  lastSync: timestamp("last_sync", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
