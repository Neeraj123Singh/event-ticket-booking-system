function trimTrailingSlashes(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Base URL for the ticketing API.
 * - Server components / Server Actions: prefer `INTERNAL_API_URL` (Docker-friendly hostname `api`).
 * - Browser: uses `NEXT_PUBLIC_API_URL` (must be reachable from the user’s machine).
 */
export function getServerApiBaseUrl(): string {
  const raw =
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:4000";
  return trimTrailingSlashes(raw);
}

export function getPublicApiBaseUrl(): string {
  return trimTrailingSlashes(
    process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000",
  );
}
