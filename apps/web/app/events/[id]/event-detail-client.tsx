"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitBooking, type BookingActionState } from "../../actions/booking";
import { getPublicApiBaseUrl } from "../../../lib/env";

type EventDetailResponse = {
  event: {
    id: string;
    name: string;
    description: string;
    venue: string;
    startsAt: string;
    totalCapacity: number;
    bookedTickets: number;
    remaining: number;
    basePriceCents: number;
    floorPriceCents: number;
    ceilingPriceCents: number;
    featured: boolean;
    currentUnitPriceCents: number;
  };
  priceBreakdown: {
    basePriceCents: number;
    lines: Array<{
      rule: string;
      rawAdjustment: number;
      weightedAdjustment: number;
    }>;
    appliedFactor: number;
  };
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(iso));
}

function SubmitButton({ soldOut }: { soldOut: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={soldOut || pending}
      className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {soldOut ? "Sold out" : pending ? "Booking…" : "Confirm booking"}
    </button>
  );
}

export function EventDetailClient({
  initial,
  eventId,
}: {
  initial: EventDetailResponse;
  eventId: string;
}) {
  const [live, setLive] = useState(initial);

  useEffect(() => {
    const base = getPublicApiBaseUrl();
    const id = setInterval(async () => {
      try {
        const res = await fetch(`${base}/events/${eventId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as EventDetailResponse;
        setLive(data);
      } catch {
        // Polling is best-effort; ignore transient network errors.
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [eventId]);

  const [state, formAction] = useActionState<
    BookingActionState | undefined,
    FormData
  >(submitBooking, undefined);

  const maxQty = useMemo(() => Math.min(20, Math.max(1, live.event.remaining)), [live.event.remaining]);
  const soldOut = live.event.remaining < 1;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{live.event.name}</h1>
            <p className="mt-2 text-zinc-600">{live.event.venue}</p>
            <p className="mt-2 text-sm text-zinc-500">{formatDate(live.event.startsAt)}</p>
          </div>
          {live.event.featured ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
              Featured
            </span>
          ) : null}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-700">{live.event.description}</p>
        <p className="mt-4 text-sm text-zinc-600">
          {live.event.remaining} tickets remaining of {live.event.totalCapacity}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Price breakdown</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Refreshes automatically every 30 seconds from the server.
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-600">Base price</dt>
              <dd className="font-medium">{formatMoney(live.priceBreakdown.basePriceCents)}</dd>
            </div>
            {live.priceBreakdown.lines.map((line) => (
              <div key={line.rule} className="flex justify-between gap-4">
                <dt className="text-zinc-600 capitalize">{line.rule} adjustment (weighted)</dt>
                <dd className="font-medium">{(line.weightedAdjustment * 100).toFixed(1)}%</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-zinc-100 pt-3">
              <dt className="text-zinc-600">Combined factor</dt>
              <dd className="font-medium">{live.priceBreakdown.appliedFactor.toFixed(3)}×</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-900">Current unit price</dt>
              <dd className="text-lg font-semibold">{formatMoney(live.event.currentUnitPriceCents)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-xs text-zinc-500">
              <dt>Floor / ceiling</dt>
              <dd>
                {formatMoney(live.event.floorPriceCents)} – {formatMoney(live.event.ceilingPriceCents)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Book tickets</h2>
          <p className="mt-1 text-sm text-zinc-600">
            We only need your email—no passwords or payment gateway in this demo.
          </p>

          {state && !state.ok ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {state.message}
            </p>
          ) : null}

          <form action={formAction} className="mt-4 space-y-4">
            <input type="hidden" name="eventId" value={eventId} />
            <label className="block text-sm font-medium text-zinc-800">
              Email
              <input
                name="userEmail"
                type="email"
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                placeholder="you@example.com"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-800">
              Quantity
              <select
                name="quantity"
                defaultValue={1}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton soldOut={soldOut} />
          </form>
        </div>
      </div>
    </div>
  );
}
