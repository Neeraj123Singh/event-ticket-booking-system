import Link from "next/link";
import { getServerApiBaseUrl } from "../../lib/env";
import { serverApiFetch } from "../../lib/server-api";

type BookingRow = {
  id: string;
  eventId: string;
  userEmail: string;
  quantity: number;
  totalPricePaidCents: number;
  unitPriceSnapshotCents: number;
  createdAt: string;
  eventName: string;
  eventVenue: string;
  eventStartsAt: string;
  currentUnitPriceCents: number | null;
};

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

async function fetchBookings(email: string): Promise<BookingRow[]> {
  const res = await serverApiFetch(
    `/bookings/by-email?email=${encodeURIComponent(email)}`,
  );
  if (!res) {
    throw new Error(
      `Cannot reach the API at ${getServerApiBaseUrl()}. Start the API or set INTERNAL_API_URL in apps/web/.env.local.`,
    );
  }
  if (!res.ok) {
    throw new Error(`Could not load bookings (${res.status})`);
  }
  const data = (await res.json()) as { bookings: BookingRow[] };
  return data.bookings;
}

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ email?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const email = sp.email?.trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My bookings</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Enter the same email you used at checkout. This is not a full account system—just a lookup.
        </p>
      </div>

      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" action="/my-bookings" method="get">
        <label className="block w-full text-sm font-medium text-zinc-800 sm:max-w-md">
          Email
          <input
            name="email"
            type="email"
            defaultValue={email ?? ""}
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="you@example.com"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Search
        </button>
      </form>

      {email ? <BookingsList email={email} /> : null}
    </div>
  );
}

async function BookingsList({ email }: { email: string }) {
  let rows: BookingRow[] = [];
  let error: string | null = null;
  try {
    rows = await fetchBookings(email);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        No bookings found for that email. Try another address or{" "}
        <Link href="/events" className="font-semibold underline">
          book a ticket
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
          <tr>
            <th className="px-4 py-3">Event</th>
            <th className="px-4 py-3">When</th>
            <th className="px-4 py-3">Qty</th>
            <th className="px-4 py-3">Paid / ticket</th>
            <th className="px-4 py-3">Live price / ticket</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((b) => (
            <tr key={b.id}>
              <td className="px-4 py-3">
                <div className="font-medium text-zinc-900">{b.eventName}</div>
                <div className="text-xs text-zinc-500">{b.eventVenue}</div>
              </td>
              <td className="px-4 py-3 text-zinc-600">{formatDate(b.eventStartsAt)}</td>
              <td className="px-4 py-3">{b.quantity}</td>
              <td className="px-4 py-3">{formatMoney(b.unitPriceSnapshotCents)}</td>
              <td className="px-4 py-3">
                {b.currentUnitPriceCents === null ? "—" : formatMoney(b.currentUnitPriceCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
