/**
 * API process entry: loads env, validates `DATABASE_URL`, starts HTTP server.
 */
import { assertDatabaseUrl, config } from "./config";
import { createApp } from "./http/app";
import { loadMonorepoEnv } from "./load-env";

loadMonorepoEnv();
assertDatabaseUrl();

const app = createApp();
/** Listen on all interfaces so Docker and `127.0.0.1` / `localhost` both work. */
app.listen(config.port, "0.0.0.0", () => {
  console.log(`Ticketing API ready on http://127.0.0.1:${config.port}`);
});
