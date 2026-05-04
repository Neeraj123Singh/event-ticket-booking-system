import type { Config } from "drizzle-kit";
import { loadToolingEnv } from "./load-tooling-env";

loadToolingEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is missing. Copy .env.example to the repo root .env (and packages/database/.env if you use one), then set DATABASE_URL.",
  );
}

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
} satisfies Config;
