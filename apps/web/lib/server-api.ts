import { getServerApiBaseUrl } from "./env";

/** Absolute URL for an API path (leading slash optional). */
export function apiHref(path: string): string {
  const base = getServerApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Server-side `fetch` to the ticketing API. Returns `null` when the connection fails
 * (ECONNREFUSED, wrong host, etc.) so pages can render guidance instead of a TypeError.
 */
export async function serverApiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  try {
    return await fetch(apiHref(path), {
      cache: "no-store",
      ...init,
    });
  } catch {
    return null;
  }
}
