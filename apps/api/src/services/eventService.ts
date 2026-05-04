import { and, asc, eq, gt, ilike, or, sql, type SQL } from "drizzle-orm";
import {
  bookings,
  events,
  type Database,
  type NewEventRow,
  type PricingRulesConfig,
} from "@repo/database";
import { computeUnitPrice } from "../pricing/engine";
import type { PricingWeights } from "../pricing/engine";
import { countBookingsInWindow } from "./bookingService";

export type ListEventsFilters = {
  /** Case-insensitive match on name or venue (extra feature). */
  search?: string;
  /** When true, only events flagged featured. */
  featuredOnly?: boolean;
};

/**
 * Lists upcoming events with optional search and featured filter.
 */
export async function listUpcomingEvents(
  db: Database,
  filters: ListEventsFilters,
  now: Date = new Date(),
) {
  const upcoming = gt(events.startsAt, now);
  let clause: SQL = upcoming;

  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    clause = and(clause, or(ilike(events.name, q), ilike(events.venue, q)))!;
  }
  if (filters.featuredOnly) {
    clause = and(clause, eq(events.featured, true))!;
  }

  return db
    .select()
    .from(events)
    .where(clause)
    .orderBy(asc(events.startsAt));
}

export async function createEvent(db: Database, row: NewEventRow) {
  const [inserted] = await db.insert(events).values(row).returning();
  return inserted;
}

export async function analyticsForEvent(
  db: Database,
  eventId: string,
  weights: PricingWeights,
) {
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) return null;

  const soldRows = await db
    .select({
      totalSold: sql<number>`coalesce(sum(${bookings.quantity}), 0)::int`,
      revenueCents: sql<number>`coalesce(sum(${bookings.totalPricePaidCents}), 0)::int`,
      avgUnit: sql<number>`
        case when coalesce(sum(${bookings.quantity}), 0) = 0 then 0
        else (coalesce(sum(${bookings.totalPricePaidCents}), 0)::float /
              coalesce(sum(${bookings.quantity}), 0)::float)
        end
      `,
    })
    .from(bookings)
    .where(eq(bookings.eventId, eventId));

  const agg = soldRows[0]!;
  const totalSold = Number(agg.totalSold);
  const revenueCents = Number(agg.revenueCents);
  const avgPricePaidCents = Math.round(Number(agg.avgUnit));

  const windowHours = event.pricingRules.demand.windowHours;
  const bookingsInWindow = await countBookingsInWindow(db, eventId, windowHours);

  const priced = computeUnitPrice({
    basePriceCents: event.basePriceCents,
    floorPriceCents: event.floorPriceCents,
    ceilingPriceCents: event.ceilingPriceCents,
    rules: event.pricingRules,
    now: new Date(),
    eventStartsAt: event.startsAt,
    bookingsInDemandWindow: bookingsInWindow,
    totalCapacity: event.totalCapacity,
    bookedTickets: event.bookedTickets,
    weights,
  });

  const remaining = event.totalCapacity - event.bookedTickets;

  return {
    eventId,
    totalSold,
    revenueCents,
    averagePricePaidCents: avgPricePaidCents,
    remaining,
    currentUnitPriceCents: priced.unitPriceCents,
  };
}

export async function analyticsSummary(db: Database) {
  const [ev] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(events);
  const [bk] = await db
    .select({
      bookingsCount: sql<number>`count(*)::int`,
      ticketsSold: sql<number>`coalesce(sum(${bookings.quantity}), 0)::int`,
      revenueCents: sql<number>`coalesce(sum(${bookings.totalPricePaidCents}), 0)::int`,
    })
    .from(bookings);

  return {
    eventsCount: Number(ev?.n ?? 0),
    bookingsCount: Number(bk?.bookingsCount ?? 0),
    ticketsSold: Number(bk?.ticketsSold ?? 0),
    revenueCents: Number(bk?.revenueCents ?? 0),
  };
}

/** Default pricing rules when admin omits body (keeps POST /events simple). */
export const defaultPricingRules = (): PricingRulesConfig => ({
  timeTiers: [
    { maxDaysUntilEvent: 1, adjustment: 0.5 },
    { maxDaysUntilEvent: 7, adjustment: 0.2 },
    { maxDaysUntilEvent: 30, adjustment: 0.05 },
    { maxDaysUntilEvent: null, adjustment: 0 },
  ],
  demand: { bookingsInWindow: 10, windowHours: 1, adjustment: 0.15 },
  inventory: { whenRemainingFractionBelow: 0.2, adjustment: 0.25 },
});
