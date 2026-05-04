import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerApiBaseUrl } from "../../../lib/env";
import { serverApiFetch } from "../../../lib/server-api";
import { EventDetailClient } from "./event-detail-client";

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
    pricingRules: unknown;
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

async function fetchEvent(
  id: string,
): Promise<EventDetailResponse | null | "unavailable"> {
  const res = await serverApiFetch(`/events/${id}`);
  if (!res) {
    return "unavailable";
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load event (${res.status})`);
  return (await res.json()) as EventDetailResponse;
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchEvent(id);
  if (data === "unavailable") {
    const apiBase = getServerApiBaseUrl();
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Event</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
          <p className="font-semibold">Cannot reach the ticketing API</p>
          <p className="mt-2">
            Tried <code className="font-mono text-xs">{apiBase}</code>. Start the API, set{" "}
            <code className="font-mono text-xs">INTERNAL_API_URL</code> in{" "}
            <code className="font-mono text-xs">.env.local</code> if needed, then refresh.
          </p>
          <Link href="/events" className="mt-4 inline-block text-sm font-semibold underline">
            Back to events
          </Link>
        </div>
      </div>
    );
  }
  if (!data) notFound();

  return <EventDetailClient initial={data} eventId={id} />;
}
