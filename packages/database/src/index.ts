import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";
export { runDemoSeed } from "./seed-runner";

export type Database = PostgresJsDatabase<typeof schema>;

let singletonDb: Database | null = null;
let singletonSql: ReturnType<typeof postgres> | null = null;

/**
 * Returns a shared Drizzle instance using `DATABASE_URL`.
 * Prefer `createDatabase` in tests for isolated connections.
 */
export function getDb(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to connect to PostgreSQL");
  }
  if (!singletonDb) {
    singletonSql = postgres(url, { max: 10 });
    singletonDb = drizzle(singletonSql, { schema });
  }
  return singletonDb;
}

/**
 * Creates a dedicated postgres.js client + Drizzle ORM instance.
 * Call `closeDatabase` when finished (e.g. end of test suite).
 */
export function createDatabase(connectionString: string): {
  db: Database;
  sql: ReturnType<typeof postgres>;
} {
  const sql = postgres(connectionString, { max: 5 });
  const db = drizzle(sql, { schema });
  return { db, sql };
}

/** Closes the singleton pool if it was opened. */
export async function closeSingletonDatabase(): Promise<void> {
  if (singletonSql) {
    await singletonSql.end({ timeout: 5 });
    singletonSql = null;
    singletonDb = null;
  }
}
