/**
 * CLI entry: loads `.env` and runs demo seed against `DATABASE_URL`.
 */
import { loadToolingEnv } from "../load-tooling-env";
import { createDatabase, closeSingletonDatabase } from "./index";

loadToolingEnv();
import { runDemoSeed } from "./seed-runner";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL in the repo root .env or packages/database/.env");
    process.exit(1);
  }

  const { db, sql } = createDatabase(url);
  const { eventsInserted } = await runDemoSeed(db);
  console.log(`Seeded ${eventsInserted} events.`);

  await sql.end({ timeout: 5 });
  await closeSingletonDatabase();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
