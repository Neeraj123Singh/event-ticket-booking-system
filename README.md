# Ticketing platform (monorepo)

Full-stack event ticketing with **dynamic pricing** (time, demand velocity, inventory), **Postgres + Drizzle**, **Express API**, and **Next.js 15** UI. Original coursework brief: [docs/ASSIGNMENT.md](docs/ASSIGNMENT.md). Architecture and trade-offs: [DESIGN.md](DESIGN.md).

## Prerequisites

- **Node.js** 20+ (LTS recommended; repo engines allow ≥18)
- **pnpm** 9 (`corepack enable && corepack prepare pnpm@9.0.0 --activate`)
- **Docker Desktop** or Docker Engine (optional, for Compose Postgres)
- **PostgreSQL** 16 if not using Docker

## Quick start

**First time only:** install deps and env (Docker maps Postgres to host **5433** so it does not conflict with a local Postgres on **5432**).

```bash
pnpm install
cp .env.example .env
```

(`DATABASE_URL` in the **repo root** `.env` is enough for `pnpm start`, the API, and Drizzle Kit; you can still add `packages/database/.env` for overrides.)

**One command to run everything** (Compose Postgres on **5433** → wait for port → `db:push` → API + web):

```bash
pnpm start
```

Then open **http://localhost:3001** (Next defaults to **3001** so it does not clash with other apps on **3000**). API listens on **http://127.0.0.1:4000**. Copy [apps/web/.env.example](apps/web/.env.example) to `apps/web/.env.local` if the browser cannot reach the API.

Load demo events once: `pnpm db:seed` (or `POST /seed` with the admin API key).

The API and **Drizzle Kit** (`db:push`, etc.) load the repo root `.env` first, then `packages/database/.env` or `apps/api/.env` if you use those for overrides.

### What `pnpm start` / `pnpm dev` do

- **`pnpm start`** — `docker compose up -d`, waits for `127.0.0.1:5433`, runs `db:push`, then Turborepo **dev** (web + API).
- **`pnpm dev`** — Same app processes only; bring Postgres up yourself if needed.

## Environment variables

| Location | Variable | Purpose |
| --- | --- | --- |
| Repo root `.env` (recommended), or `packages/database/.env` / `apps/api/.env` | `DATABASE_URL` | Postgres connection string |
| `apps/api/.env` | `PORT` | API port (default `4000`) |
| `apps/api/.env` | `ADMIN_API_KEY` | Required in `x-api-key` for `POST /events`, `POST /seed`, `GET /analytics/export.csv` |
| `apps/api/.env` | `CORS_ORIGIN` | Comma-separated allowed browser origins |
| `apps/api/.env` | `PRICING_WEIGHT_TIME`, `PRICING_WEIGHT_DEMAND`, `PRICING_WEIGHT_INVENTORY` | Rule weights (default `1`) |
| `apps/api/.env` | `TEST_DATABASE_URL` | When set, enables DB integration + concurrency Vitest suites |
| `apps/web/.env.local` | `NEXT_PUBLIC_API_URL` | API base URL for the browser |
| `apps/web/.env.local` | `INTERNAL_API_URL` | API base URL for server components / server actions |

See [`.env.example`](.env.example) for copy-paste values aligned with `docker-compose.yml`.

## Useful commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Run Next.js + API via Turborepo |
| `pnpm build` | Production build |
| `pnpm check-types` | TypeScript across workspaces |
| `pnpm test` | Vitest (pricing unit tests; DB tests if `TEST_DATABASE_URL` is set) |
| `pnpm db:push` | Apply Drizzle schema (`drizzle-kit push --force`, non-interactive for `pnpm start` / CI) |
| `pnpm db:seed` | Insert demo events + sample capacities |

## API highlights

- **Core routes:** `GET /events`, `GET /events/:id`, `POST /bookings`, `GET /bookings?eventId=`, analytics routes, `POST /seed` (admin).
- **Extras:** `GET /health` (includes DB ping), `GET /events?q=&featured=true`, `GET /bookings/by-email?email=`, `GET /analytics/export.csv` (admin CSV).

## Testing

```bash
pnpm test
# With Postgres (same URL as local DB is fine):
TEST_DATABASE_URL="postgresql://ticketing:ticketing@localhost:5433/ticketing" pnpm test
```

Ensure schema is pushed before DB-backed tests. Pricing logic has dedicated unit tests; integration and concurrency suites require `TEST_DATABASE_URL`.

## Deploy notes

- Run **migrations/push** against your managed Postgres, set secrets (`ADMIN_API_KEY`, `DATABASE_URL`), and expose the API behind HTTPS.
- Point **Next.js** `NEXT_PUBLIC_API_URL` / `INTERNAL_API_URL` at the deployed API host.
- Start commands: `pnpm --filter api start` (uses `tsx` to run TypeScript directly) and `pnpm --filter web start` after `pnpm build`.

## Troubleshooting

- **`pnpm install` postinstall errors (esbuild):** retry with `pnpm install --ignore-scripts`, then `pnpm rebuild` for native deps if needed.
- **Web cannot reach API:** confirm `NEXT_PUBLIC_API_URL` uses a host the browser can resolve (not `localhost` inside Docker unless mapped correctly).
- **`drizzle-kit push` stuck on Yes/No:** the repo script uses `--force` so pushes do not wait for a TTY; upgrade Drizzle Kit if you still see an interactive prompt.
- **`http://localhost:3000/` shows JSON `Cannot GET /`:** port **3000** is not this Next app (often another Express/Nest process). Use **http://localhost:3001/** or free port 3000 and set the web `dev`/`start` script port back to 3000.
# event-ticket-booking-system
