# Design notes

## Pricing algorithm

Ticket prices are computed in cents as integers to avoid floating-point drift. Each event stores a JSON `pricingRules` document describing time tiers, a demand window (booking count threshold and window length in hours), and an inventory threshold (remaining fraction of capacity). The engine evaluates three raw fractional adjustments—for example +0.2 for “within seven days”—then multiplies each by an environment-controlled weight (`PRICING_WEIGHT_*`). The final multiplier is `1 + Σ weightedAdjustments`, applied to `basePriceCents`, then clamped to `[floor, ceiling]`. This matches the brief’s “sum of weighted adjustments” model while keeping the pure calculation in a single deterministic function that accepts an explicit `now` for tests.

Time tiers are sorted by ascending `maxDaysUntilEvent` so the tightest matching bucket wins. Demand uses a rolling count of rows in `bookings` for that event since `now - windowHours`. Inventory compares unsold fraction to `whenRemainingFractionBelow`. Keeping rules in JSON per event allows demos with different curves without redeploying code.

## Concurrency

Overselling is prevented by booking inside a single database transaction that runs `SELECT … FROM events WHERE id = $1 LIMIT 1 FOR UPDATE` before checking capacity, inserting the booking, and incrementing `bookedTickets`. The row lock serializes competing transactions on the same event; the second waiter sees the updated capacity and fails with a `409` style domain error. This is simpler than optimistic retries and matches PostgreSQL’s strengths for hot rows.

## Monorepo layout

`@repo/database` owns Drizzle schema, the shared client factory, and `runDemoSeed` so both the CLI seed and `POST /seed` stay aligned. `apps/api` hosts the Express REST surface, pricing engine, and Vitest suites. `apps/web` is a Next.js 15 App Router UI that calls the API over HTTP (clear separation, easy to scale out later). Turborepo orchestrates `dev`, `build`, and type checks across packages.

## Trade-offs

We denormalize `bookedTickets` on `events` for fast reads and simpler locking instead of deriving availability from `SUM(bookings.quantity)` on every write (which would still require careful locking). Admin auth is a single shared API key header—adequate for the assignment but not production-grade. Integration tests hit a real Postgres when `TEST_DATABASE_URL` is set; otherwise they skip so `pnpm test` stays frictionless in sandboxes.

## With more time

Add idempotent booking keys, Stripe-style payment state, structured logging/metrics, generated OpenAPI from Zod, and Redis caching for hot event reads. Harden CSV export with streaming and auth scopes, and replace the API key with proper RBAC.
