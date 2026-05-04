import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, createDatabase, events } from "@repo/database";
import { defaultPricingRules } from "./eventService";
import {
  bookTickets,
  InsufficientInventoryError,
} from "./bookingService";

const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

/**
 * Proves two simultaneous purchasers cannot oversell the final seat.
 */
describeDb("concurrent bookings", () => {
  const { db, sql } = createDatabase(url!);
  let eventId: string;

  beforeAll(async () => {
    eventId = randomUUID();
    await db.insert(events).values({
      id: eventId,
      name: "Concurrency fixture",
      description: "temp",
      venue: "Lab",
      startsAt: new Date(Date.now() + 3 * 86_400_000),
      totalCapacity: 1,
      bookedTickets: 0,
      basePriceCents: 1000,
      floorPriceCents: 500,
      ceilingPriceCents: 5000,
      pricingRules: defaultPricingRules(),
      featured: false,
    });
  });

  afterAll(async () => {
    await db.delete(bookings).where(eq(bookings.eventId, eventId));
    await db.delete(events).where(eq(events.id, eventId));
    await sql.end({ timeout: 5 });
  });

  it("prevents overbooking of last ticket", async () => {
    const weights = { time: 1, demand: 1, inventory: 1 } as const;

    const first = bookTickets(db, {
      eventId,
      userEmail: "a@example.com",
      quantity: 1,
      weights,
    });
    const second = bookTickets(db, {
      eventId,
      userEmail: "b@example.com",
      quantity: 1,
      weights,
    });

    const outcomes = await Promise.allSettled([first, second]);
    const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
    const rejected = outcomes.filter((o) => o.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.status).toBe("rejected");
    if (rejected[0]?.status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(InsufficientInventoryError);
    }

    const [ev] = await db.select().from(events).where(eq(events.id, eventId));
    expect(ev!.bookedTickets).toBe(1);
  });
});
