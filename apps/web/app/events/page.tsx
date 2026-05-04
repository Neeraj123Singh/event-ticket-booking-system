import Link from "next/link";
import { getServerApiBaseUrl } from "../../lib/env";
import { serverApiFetch } from "../../lib/server-api";

type EventListItem = {
  id: string;
  name: string;
  venue: string;
  startsAt: string;
  featured?: boolean;
  currentUnitPriceCents: number;
  remaining: number;
  totalCapacity: number;
};

async function fetchEvents(searchParams: {
  q?: string;
  featured?: string;
}): Promise<
  | { ok: true; events: EventListItem[] }
  | { ok: false; apiBase: string }
> {
  const apiBase = getServerApiBaseUrl();
  const params = new URLSearchParams();
  if (searchParams.q) params.set("q", searchParams.q);
  if (searchParams.featured === "1") params.set("featured", "true");
  const path = params.toString() ? `/events?${params.toString()}` : "/events";

  const res = await serverApiFetch(path);
  if (!res) {
    return { ok: false, apiBase };
  }
  if (!res.ok) {
    throw new Error(`Failed to load events (${res.status})`);
  }
  const data = (await res.json()) as { events: EventListItem[] };
  return { ok: true, events: data.events };
}

function ApiConnectionError({ apiBase }: { apiBase: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
      <p className="font-semibold">Cannot reach the ticketing API</p>
      <p className="mt-2 text-amber-900/90">
        Tried{" "}
        <code className="rounded bg-amber-100/80 px-1 py-0.5 font-mono text-xs">{apiBase}</code>.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-amber-900/90">
        <li>
          Run the API from the repo root: <code className="font-mono text-xs">pnpm dev</code> (starts
          web + API) or <code className="font-mono text-xs">pnpm --filter api dev</code> in a second
          terminal.
        </li>
        <li>
          The API needs <code className="font-mono text-xs">DATABASE_URL</code> and Postgres. Put it
          in the repo root <code className="font-mono text-xs">.env</code> or{" "}
          <code className="font-mono text-xs">apps/api/.env</code>, then run{" "}
          <code className="font-mono text-xs">pnpm db:push</code> /{" "}
          <code className="font-mono text-xs">pnpm db:seed</code>. Watch the API terminal for startup
          errors.
        </li>
        <li>
          If the API is elsewhere, set <code className="font-mono text-xs">INTERNAL_API_URL</code> in{" "}
          <code className="font-mono text-xs">apps/web/.env.local</code> (Docker: use the API service
          hostname, not <code className="font-mono text-xs">localhost</code>).
        </li>
      </ul>
    </div>
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; featured?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const result = await fetchEvents(sp);

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Upcoming events</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Live prices reflect demand, inventory, and how soon the show starts.
          </p>
        </div>
        <ApiConnectionError apiBase={result.apiBase} />
      </div>
    );
  }

  const events = result.events;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Upcoming events</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Live prices reflect demand, inventory, and how soon the show starts.
          </p>
        </div>
        <form className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row" action="/events">
          <input
            name="q"
            defaultValue={sp.q}
            placeholder="Search name or venue"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm sm:w-64"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" name="featured" value="1" defaultChecked={sp.featured === "1"} />
            Featured only
          </label>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Apply
          </button>
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {events.length === 0 ? (
          <p className="text-sm text-zinc-600">No events match your filters.</p>
        ) : (
          events.map((e) => (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight group-hover:underline">
                    {e.name}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-600">{e.venue}</p>
                  <p className="mt-2 text-xs text-zinc-500">{formatDate(e.startsAt)}</p>
                </div>
                {e.featured ? (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                    Featured
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="font-medium text-zinc-900">{formatMoney(e.currentUnitPriceCents)}</span>
                <span className="text-zinc-600">
                  {e.remaining} / {e.totalCapacity} left
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
