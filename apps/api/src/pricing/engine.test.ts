import { describe, expect, it } from "vitest";
import type { PricingRulesConfig } from "@repo/database";
import {
  computeUnitPrice,
  daysUntilEvent,
  demandAdjustment,
  inventoryAdjustment,
  timeAdjustment,
} from "./engine";

const rules = (): PricingRulesConfig => ({
  timeTiers: [
    { maxDaysUntilEvent: 1, adjustment: 0.5 },
    { maxDaysUntilEvent: 7, adjustment: 0.2 },
    { maxDaysUntilEvent: 30, adjustment: 0.05 },
    { maxDaysUntilEvent: null, adjustment: 0 },
  ],
  demand: { bookingsInWindow: 10, windowHours: 1, adjustment: 0.15 },
  inventory: { whenRemainingFractionBelow: 0.2, adjustment: 0.25 },
});

const weights = { time: 1, demand: 1, inventory: 1 };

describe("daysUntilEvent", () => {
  it("floors fractional days", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const start = new Date("2026-01-03T10:00:00Z");
    expect(daysUntilEvent(now, start)).toBe(1);
  });

  it("returns 0 when event already started", () => {
    const now = new Date("2026-02-01T00:00:00Z");
    const start = new Date("2026-01-01T00:00:00Z");
    expect(daysUntilEvent(now, start)).toBe(0);
  });
});

describe("timeAdjustment", () => {
  it("applies highest matching tier", () => {
    expect(timeAdjustment(rules(), 0)).toBe(0.5);
    expect(timeAdjustment(rules(), 1)).toBe(0.5);
    expect(timeAdjustment(rules(), 2)).toBe(0.2);
    expect(timeAdjustment(rules(), 7)).toBe(0.2);
    expect(timeAdjustment(rules(), 8)).toBe(0.05);
    expect(timeAdjustment(rules(), 100)).toBe(0);
  });
});

describe("demandAdjustment", () => {
  it("fires only when strictly above threshold", () => {
    expect(demandAdjustment(rules(), 10)).toBe(0);
    expect(demandAdjustment(rules(), 11)).toBe(0.15);
  });
});

describe("inventoryAdjustment", () => {
  it("fires when remaining fraction is below threshold", () => {
    // 100 capacity, 86 sold -> 14 remaining -> 0.14 < 0.2
    expect(inventoryAdjustment(rules(), 100, 86)).toBe(0.25);
    expect(inventoryAdjustment(rules(), 100, 70)).toBe(0);
  });

  it("returns 0 for zero capacity", () => {
    expect(inventoryAdjustment(rules(), 0, 0)).toBe(0);
  });
});

describe("computeUnitPrice", () => {
  const baseInput = {
    basePriceCents: 10_000,
    floorPriceCents: 5_000,
    ceilingPriceCents: 20_000,
    rules: rules(),
    now: new Date("2026-06-01T00:00:00Z"),
    eventStartsAt: new Date("2026-06-10T00:00:00Z"),
    bookingsInDemandWindow: 0,
    totalCapacity: 100,
    bookedTickets: 10,
    weights,
  };

  it("respects floor when rules pull price down (weights 0)", () => {
    const r = computeUnitPrice({
      ...baseInput,
      weights: { time: 0, demand: 0, inventory: 0 },
      floorPriceCents: 12_000,
    });
    expect(r.unitPriceCents).toBe(12_000);
  });

  it("respects ceiling when rules push price up", () => {
    const r = computeUnitPrice({
      ...baseInput,
      ceilingPriceCents: 11_000,
      eventStartsAt: new Date("2026-06-01T12:00:00Z"),
      now: new Date("2026-06-01T00:00:00Z"),
      weights: { time: 2, demand: 2, inventory: 2 },
      bookedTickets: 95,
      bookingsInDemandWindow: 20,
    });
    expect(r.unitPriceCents).toBe(11_000);
  });

  it("combines weighted adjustments", () => {
    const r = computeUnitPrice({
      ...baseInput,
      weights: { time: 0.5, demand: 1, inventory: 1 },
      bookingsInDemandWindow: 11,
      bookedTickets: 90,
    });
    const timeRaw = timeAdjustment(baseInput.rules, daysUntilEvent(baseInput.now, baseInput.eventStartsAt));
    const demandRaw = demandAdjustment(baseInput.rules, 11);
    const invRaw = inventoryAdjustment(baseInput.rules, 100, 90);
    const factor =
      1 + timeRaw * 0.5 + demandRaw * 1 + invRaw * 1;
    expect(r.unitPriceCents).toBe(Math.round(10_000 * factor));
  });
});
