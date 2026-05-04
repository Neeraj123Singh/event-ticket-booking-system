import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Loads `.env` from the monorepo root (if present) then from `process.cwd()` so
 * `DATABASE_URL` can live in a single root file while `pnpm --filter api dev` runs with cwd `apps/api`.
 */
export function loadMonorepoEnv(): void {
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

  const cwdEnv = resolve(process.cwd(), ".env");
  if (existsSync(cwdEnv)) {
    loadEnv({ path: cwdEnv, override: true });
  }
}
