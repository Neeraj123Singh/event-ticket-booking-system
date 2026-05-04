import type { EventRow } from "@repo/database";
import type { Database } from "@repo/database";
import { computeUnitPrice } from "../pricing/engine";
import type { PricingWeights } from "../pricing/engine";
import { countBookingsInWindow } from "../services/bookingService";

/**
 * Computes live unit price + rule breakdown for a materialized event row.
 */
export async function livePriceForEvent(
  db: Database,
  event: EventRow,
  weights: PricingWeights,
) {
  const windowHours = event.pricingRules.demand.windowHours;
  const bookingsInWindow = await countBookingsInWindow(
    db,
    event.id,
    windowHours,
  );
  return computeUnitPrice({
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
}
