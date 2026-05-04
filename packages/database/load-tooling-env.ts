/**
 * Drizzle Kit / CLI run with cwd `packages/database` and do not load `.env` by default.
 * Mirror the API: load repo root `.env` first, then local `packages/database/.env`.
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function loadToolingEnv(): void {
  let dir = process.cwd();
  for (let depth = 0; depth < 8; depth++) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) {
      const rootEnv = resolve(dir, ".env");
      if (existsSync(rootEnv)) {
        loadEnv({ path: rootEnv });
      }
      break;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }

  const localEnv = resolve(process.cwd(), ".env");
  if (existsSync(localEnv)) {
    loadEnv({ path: localEnv, override: true });
  }
}
