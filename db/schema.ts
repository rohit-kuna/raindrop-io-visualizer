import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

/**
 * Users table
 * - One row per Clerk user
 * - raindropToken is the user's personal Raindrop.io "test token", AES-256-GCM
 *   encrypted at rest (see lib/crypto.ts). Null until they connect their account.
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

    raindropToken: text("raindrop_token"),

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
 * Collections table
 * - Mirrors a user's Raindrop.io collections
 */
export const collections = pgTable(
  "collections",
  {
    id: serial("id").primaryKey(),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Raindrop.io's own collection id
    raindropCollectionId: integer("raindrop_collection_id").notNull(),

    title: varchar("title", { length: 255 }).notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("collections_user_raindrop_id_idx").on(
      table.userId,
      table.raindropCollectionId
    ),
    index("collections_user_id_idx").on(table.userId),
  ]
);

/**
 * Tags table
 * - Raindrop tags are plain strings scoped per user (no native id)
 */
export const tags = pgTable(
  "tags",
  {
    id: serial("id").primaryKey(),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 255 }).notNull(),
  },
  (table) => [
    uniqueIndex("tags_user_name_idx").on(table.userId, table.name),
    index("tags_user_id_idx").on(table.userId),
  ]
);

/**
 * Raindrops table
 * - One row per saved bookmark
 */
export const raindrops = pgTable(
  "raindrops",
  {
    id: serial("id").primaryKey(),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Raindrop.io's own raindrop id
    raindropId: integer("raindrop_id").notNull(),

    title: varchar("title", { length: 1024 }).notNull(),
    link: text("link").notNull(),
    excerpt: text("excerpt"),
    domain: varchar("domain", { length: 255 }),
    cover: text("cover"),
    type: varchar("type", { length: 32 }),

    collectionId: integer("collection_id").references(() => collections.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    lastUpdate: timestamp("last_update", { withTimezone: true }).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("raindrops_user_raindrop_id_idx").on(
      table.userId,
      table.raindropId
    ),
    index("raindrops_user_id_idx").on(table.userId),
    index("raindrops_collection_id_idx").on(table.collectionId),
  ]
);

/**
 * Raindrop <-> Tag join table (many-to-many)
 * - userId is denormalized here so tag-first graph queries don't need a join
 */
export const raindropTags = pgTable(
  "raindrop_tags",
  {
    raindropId: integer("raindrop_id")
      .notNull()
      .references(() => raindrops.id, { onDelete: "cascade" }),

    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.raindropId, table.tagId] }),
    index("raindrop_tags_user_tag_idx").on(table.userId, table.tagId),
    index("raindrop_tags_tag_id_idx").on(table.tagId),
  ]
);
