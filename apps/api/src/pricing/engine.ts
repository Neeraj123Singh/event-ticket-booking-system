import type { PricingRulesConfig } from "@repo/database";

export type PricingWeights = {
  time: number;
  demand: number;
  inventory: number;
};

export type ComputePriceInput = {
  basePriceCents: number;
  floorPriceCents: number;
  ceilingPriceCents: number;
  rules: PricingRulesConfig;
  /** Clock used for deterministic tests. */
  now: Date;
  eventStartsAt: Date;
  /** Bookings counted in the rolling demand window (exclusive of the booking being priced). */
  bookingsInDemandWindow: number;
  totalCapacity: number;
  bookedTickets: number;
  weights: PricingWeights;
};

export type PriceBreakdownLine = {
  rule: "time" | "demand" | "inventory";
  /** Raw fractional adjustment from business rules (e.g. 0.2 = +20%). */
  rawAdjustment: number;
  /** `rawAdjustment * weight` for this rule. */
  weightedAdjustment: number;
};

export type ComputePriceResult = {
  unitPriceCents: number;
  breakdown: PriceBreakdownLine[];
};

/** Milliseconds in one day (no DST handling; acceptable for ticketing horizons). */
const MS_PER_DAY = 86_400_000;

function clampCents(value: number, floor: number, ceiling: number): number {
  return Math.min(ceiling, Math.max(floor, Math.round(value)));
}

/**
 * Days from `now` until `eventStartsAt`, floored at 0 for past events.
 */
export function daysUntilEvent(now: Date, eventStartsAt: Date): number {
  const diff = eventStartsAt.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.floor(diff / MS_PER_DAY);
}

/**
 * Picks the time-tier adjustment: tiers should be ordered with smaller
 * `maxDaysUntilEvent` first; the first tier where `daysUntil <= maxDays` wins.
 * A `null` max acts as a catch-all bucket.
 */
export function timeAdjustment(
  rules: PricingRulesConfig,
  daysUntil: number,
): number {
  const tiers = [...rules.timeTiers].sort((a, b) => {
    const am = a.maxDaysUntilEvent ?? Number.POSITIVE_INFINITY;
    const bm = b.maxDaysUntilEvent ?? Number.POSITIVE_INFINITY;
    return am - bm;
  });
  for (const tier of tiers) {
    if (tier.maxDaysUntilEvent === null) return tier.adjustment;
    if (daysUntil <= tier.maxDaysUntilEvent) return tier.adjustment;
  }
  return 0;
}

export function demandAdjustment(
  rules: PricingRulesConfig,
  bookingsInWindow: number,
): number {
  if (bookingsInWindow > rules.demand.bookingsInWindow) {
    return rules.demand.adjustment;
  }
  return 0;
}

export function inventoryAdjustment(
  rules: PricingRulesConfig,
  totalCapacity: number,
  bookedTickets: number,
): number {
  if (totalCapacity <= 0) return 0;
  const remaining = totalCapacity - bookedTickets;
  const remainingFraction = remaining / totalCapacity;
  if (remainingFraction < rules.inventory.whenRemainingFractionBelow) {
    return rules.inventory.adjustment;
  }
  return 0;
}

/**
 * Computes per-ticket price from weighted rule adjustments and clamps to floor/ceiling.
 */
export function computeUnitPrice(input: ComputePriceInput): ComputePriceResult {
  const days = daysUntilEvent(input.now, input.eventStartsAt);
  const rawTime = timeAdjustment(input.rules, days);
  const rawDemand = demandAdjustment(input.rules, input.bookingsInDemandWindow);
  const rawInv = inventoryAdjustment(
    input.rules,
    input.totalCapacity,
    input.bookedTickets,
  );

  const w = input.weights;
  const weightedTime = rawTime * w.time;
  const weightedDemand = rawDemand * w.demand;
  const weightedInv = rawInv * w.inventory;

  const factor = 1 + weightedTime + weightedDemand + weightedInv;
  const unit = input.basePriceCents * factor;

  return {
    unitPriceCents: clampCents(
      unit,
      input.floorPriceCents,
      input.ceilingPriceCents,
    ),
    breakdown: [
      {
        rule: "time",
        rawAdjustment: rawTime,
        weightedAdjustment: weightedTime,
      },
      {
        rule: "demand",
        rawAdjustment: rawDemand,
        weightedAdjustment: weightedDemand,
      },
      {
        rule: "inventory",
        rawAdjustment: rawInv,
        weightedAdjustment: weightedInv,
      },
    ],
  };
}
