/**
 * Centralized environment configuration with safe defaults for local development.
 * All values are read once at process startup (import side effects kept minimal).
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (Number.isNaN(n)) return fallback;
  return n;
}

export const config = {
  /** HTTP port for the REST API. */
  port: optionalNumber("PORT", 4000),
  /** Shared secret for admin routes (`POST /events`, `POST /seed`). */
  adminApiKey: process.env.ADMIN_API_KEY ?? "dev-admin-key-change-me",
  /** Comma-separated browser origins for CORS (first is primary). */
  /** Default includes 3001 (this repo’s Next port) and 3000 (common default) so CORS works either way. */
  corsOrigins: (
    process.env.CORS_ORIGIN ??
    "http://localhost:3001,http://127.0.0.1:3001,http://localhost:3000,http://127.0.0.1:3000"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  /**
   * Multipliers applied to each raw pricing delta before summing.
   * Formula: `base * (1 + w_time*a_time + w_demand*a_demand + w_inv*a_inv)`.
   */
  pricingWeights: {
    time: optionalNumber("PRICING_WEIGHT_TIME", 1),
    demand: optionalNumber("PRICING_WEIGHT_DEMAND", 1),
    inventory: optionalNumber("PRICING_WEIGHT_INVENTORY", 1),
  },
  /** Optional override for tests; production uses `DATABASE_URL` via `@repo/database`. */
  databaseUrl: process.env.DATABASE_URL,
};

export function assertDatabaseUrl(): string {
  return config.databaseUrl ?? required("DATABASE_URL");
}
