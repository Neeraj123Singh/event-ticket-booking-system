import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight">
          Event ticketing with dynamic pricing
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-600">
          Prices react to time-to-event, recent demand, and remaining inventory. Browse
          events, inspect the live breakdown, and complete a booking with your email—no
          separate login required.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/events"
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Browse events
          </Link>
          <Link
            href="/my-bookings"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Look up my bookings
          </Link>
        </div>
      </div>
    </div>
  );
}
