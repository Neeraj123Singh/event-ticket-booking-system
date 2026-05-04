import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, createDatabase, events } from "@repo/database";
import { defaultPricingRules } from "./eventService";
import { bookTickets } from "./bookingService";

const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb("booking integration (requires TEST_DATABASE_URL + schema)", () => {
  const { db, sql } = createDatabase(url!);
  let eventId: string;

  beforeAll(async () => {
    eventId = randomUUID();
    await db.insert(events).values({
      id: eventId,
      name: "Vitest booking flow",
      description: "temp",
      venue: "Lab",
      startsAt: new Date(Date.now() + 5 * 86_400_000),
      totalCapacity: 5,
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

  it("books tickets and updates capacity", async () => {
    const r = await bookTickets(db, {
      eventId,
      userEmail: "buyer@example.com",
      quantity: 2,
      weights: { time: 1, demand: 1, inventory: 1 },
    });
    expect(r.quantity).toBe(2);
    expect(r.totalPricePaidCents).toBe(r.unitPriceSnapshotCents * 2);

    const [ev] = await db.select().from(events).where(eq(events.id, eventId));
    expect(ev!.bookedTickets).toBe(2);
  });
});
