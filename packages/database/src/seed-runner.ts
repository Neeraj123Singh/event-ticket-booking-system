import { randomUUID } from "node:crypto";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

const defaultRules = (): schema.PricingRulesConfig => ({
  timeTiers: [
    { maxDaysUntilEvent: 1, adjustment: 0.5 },
    { maxDaysUntilEvent: 7, adjustment: 0.2 },
    { maxDaysUntilEvent: 30, adjustment: 0.05 },
    { maxDaysUntilEvent: null, adjustment: 0 },
  ],
  demand: { bookingsInWindow: 10, windowHours: 1, adjustment: 0.15 },
  inventory: { whenRemainingFractionBelow: 0.2, adjustment: 0.25 },
});

/**
 * Wipes bookings/events and inserts demo rows. Safe for dev and `POST /seed`.
 */
export async function runDemoSeed(db: Db): Promise<{ eventsInserted: number }> {
  await db.delete(schema.bookings);
  await db.delete(schema.events);

  const now = new Date();
  const inDays = (d: number) =>
    new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  const demoEvents = [
    {
      id: randomUUID(),
      name: "Indie Night Live",
      description: "Local bands, standing room only.",
      venue: "The Basement, Austin",
      startsAt: inDays(2),
      totalCapacity: 120,
      bookedTickets: 95,
      basePriceCents: 2500,
      floorPriceCents: 2000,
      ceilingPriceCents: 8000,
      pricingRules: defaultRules(),
      featured: true,
    },
    {
      id: randomUUID(),
      name: "Tech Conference 2026",
      description: "Keynotes and workshops.",
      venue: "Convention Center Hall A",
      startsAt: inDays(45),
      totalCapacity: 2000,
      bookedTickets: 400,
      basePriceCents: 15000,
      floorPriceCents: 12000,
      ceilingPriceCents: 35000,
      pricingRules: defaultRules(),
      featured: true,
    },
    {
      id: randomUUID(),
      name: "Jazz in the Park",
      description: "Outdoor evening session.",
      venue: "Riverside Amphitheater",
      startsAt: inDays(14),
      totalCapacity: 500,
      bookedTickets: 120,
      basePriceCents: 3500,
      floorPriceCents: 2500,
      ceilingPriceCents: 12000,
      pricingRules: defaultRules(),
      featured: false,
    },
    {
      id: randomUUID(),
      name: "Stress Test: Single Seat Left",
      description: "Used by automated concurrency tests; one ticket left.",
      venue: "Test Arena",
      startsAt: inDays(1),
      totalCapacity: 1,
      bookedTickets: 0,
      basePriceCents: 1000,
      floorPriceCents: 500,
      ceilingPriceCents: 5000,
      pricingRules: defaultRules(),
      featured: false,
    },
  ];

  await db.insert(schema.events).values(demoEvents);
  return { eventsInserted: demoEvents.length };
}
