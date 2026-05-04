# `@repo/database`

Drizzle ORM models and helpers shared by the API and tooling.

## Contents

- `src/schema.ts` — `events` and `bookings` tables (capacity, JSON pricing rules, featured flag).
- `src/index.ts` — `getDb()`, `createDatabase()`, `runDemoSeed` export.
- `src/seed-runner.ts` — programmatic seed used by the CLI and `POST /seed`.
- `src/seed.ts` — CLI entry (`pnpm db:seed`).

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. Apply schema: `pnpm db:push` (from repo root: `pnpm db:push`).
3. Load demo data: `pnpm db:seed`.

For migration-based workflows you can still use `pnpm db:generate` / `pnpm db:migrate`; local development typically uses `db:push`.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm db:push` | Sync schema to Postgres (dev) |
| `pnpm db:seed` | Insert demo events |
| `pnpm db:studio` | Drizzle Studio UI |
| `pnpm db:generate` / `pnpm db:migrate` | SQL migrations |

## References

- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
