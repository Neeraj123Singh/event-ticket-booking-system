import Link from "next/link";
import { serverApiFetch } from "../../../lib/server-api";

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

async function fetchCurrentPrice(eventId: string): Promise<number | null> {
  const res = await serverApiFetch(`/events/${eventId}`);
  if (!res?.ok) return null;
  const data = (await res.json()) as { event: { currentUnitPriceCents: number } };
  return data.event.currentUnitPriceCents;
}

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const bookingId = typeof sp.bookingId === "string" ? sp.bookingId : null;
  const eventId = typeof sp.eventId === "string" ? sp.eventId : null;
  const unit = typeof sp.unit === "string" ? Number(sp.unit) : NaN;
  const total = typeof sp.total === "string" ? Number(sp.total) : NaN;
  const qty = typeof sp.qty === "string" ? Number(sp.qty) : NaN;

  if (!bookingId || !eventId || Number.isNaN(unit) || Number.isNaN(total) || Number.isNaN(qty)) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Missing booking details. If you arrived here manually, start from an{" "}
        <Link href="/events" className="font-semibold underline">
          event page
        </Link>
        .
      </div>
    );
  }

  const current = await fetchCurrentPrice(eventId);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
        <h1 className="text-2xl font-semibold tracking-tight">Booking confirmed</h1>
        <p className="mt-2 text-sm">
          Reference <span className="font-mono text-xs">{bookingId}</span>
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Receipt</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Tickets</dt>
            <dd className="font-medium">{qty}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Price per ticket (at purchase)</dt>
            <dd className="font-medium">{formatMoney(unit)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Total paid</dt>
            <dd className="font-semibold">{formatMoney(total)}</dd>
          </div>
          {current !== null ? (
            <div className="flex justify-between gap-4 border-t border-zinc-100 pt-3">
              <dt className="text-zinc-600">Current live unit price</dt>
              <dd className="font-medium">{formatMoney(current)}</dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/events"
            className="inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Back to events
          </Link>
          <Link
            href="/my-bookings"
            className="inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            View my bookings
          </Link>
        </div>
      </div>
    </div>
  );
}
