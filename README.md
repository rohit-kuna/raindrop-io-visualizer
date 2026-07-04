# Raindrop Graph

Explore your [Raindrop.io](https://raindrop.io) bookmarks as an interactive radial graph:
tags are colored cluster nodes arranged in a circle, raindrops are dots pulled toward the
centroid of their tag(s). Hover a dot for a preview, hover/click a tag to filter, search
across titles and excerpts.

Built with Next.js (App Router, TypeScript), Drizzle + Postgres, Clerk auth, and a
one-shot `d3-force` layout rendered on a single `<canvas>`.

## Setup

1. Copy envs and fill them in (see below):

```bash
cp .env.example .env.local
```

2. Start Postgres (optional local helper — Supabase/any Postgres works too):

```bash
npm run dockerup
```

3. Push the schema:

```bash
npm run drizzle-push
```

4. Run the app:

```bash
npm run dev
```

5. Sign up (Clerk), then go to **Settings** and paste a Raindrop.io
   [test token](https://app.raindrop.io/settings/integrations) to connect your account.
   Click **Sync** on the graph page to pull your bookmarks in.

## Required Environment Variables

See `.env.example`:

- `DATABASE_URL` — Postgres connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — Clerk auth
- `TOKEN_ENCRYPTION_KEY` — 32-byte hex key encrypting each user's stored Raindrop token
  (`openssl rand -hex 32`)
- `CRON_SECRET` — verifies Vercel Cron's calls to `/api/cron/sync`

## Auth & data model

- Clerk protects every route except `/`, `/sign-in`, `/sign-up`, and `/api/cron/*`
  (enforced in `proxy.ts`, Next's middleware convention).
- Each Clerk user gets a `users` row on first login (`app/lib/user-sync.ts`).
- Every table (`collections`, `raindrops`, `tags`, `raindrop_tags`) is scoped by
  `user_id` — this is a multi-user app, and each user only ever sees their own data.
- Each user's Raindrop.io token is entered in **Settings**, encrypted with
  `TOKEN_ENCRYPTION_KEY`, and stored on their `users` row (never displayed back).

## Sync

- `POST /api/sync` — syncs the signed-in user's own Raindrop collection.
- `GET /api/cron/sync` — Vercel Cron entrypoint (see `vercel.json`), syncs every user
  who has connected a token. Verifies `CRON_SECRET` itself since cron requests can't
  carry a Clerk session.

## Routes

- `/` — landing page
- `/sign-in`, `/sign-up` — Clerk auth
- `/dashboard` — the graph
- `/dashboard/settings` — connect/disconnect your Raindrop.io account
