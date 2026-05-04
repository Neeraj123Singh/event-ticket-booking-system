import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    files: ["lib/env.ts", "lib/server-api.ts"],
    rules: {
      // Vars are documented in root `turbo.json` `globalEnv`; plugin cache can miss them during `next build`.
      "turbo/no-undeclared-env-vars": "off",
    },
  },
];
