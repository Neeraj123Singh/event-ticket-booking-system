import { and, asc, count, eq, gte } from "drizzle-orm";
import {
  bookings,
  events,
  type Database,
  type EventRow,
} from "@repo/database";
import { computeUnitPrice } from "../pricing/engine";
import type { PricingWeights } from "../pricing/engine";

export class InsufficientInventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientInventoryError";
  }
}

export class EventNotFoundError extends Error {
  constructor() {
    super("Event not found");
    this.name = "EventNotFoundError";
  }
}

/**
 * Counts bookings in the rolling window used by the demand-based pricing rule.
 */
export async function countBookingsInWindow(
  tx: Database,
  eventId: string,
  windowHours: number,
): Promise<number> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const [row] = await tx
    .select({ c: count() })
    .from(bookings)
    .where(
      and(eq(bookings.eventId, eventId), gte(bookings.createdAt, since)),
    );
  return Number(row?.c ?? 0);
}

export type BookTicketsInput = {
  eventId: string;
  userEmail: string;
  quantity: number;
  weights: PricingWeights;
};

export type BookTicketsResult = {
  bookingId: string;
  unitPriceSnapshotCents: number;
  totalPricePaidCents: number;
  quantity: number;
  breakdown: ReturnType<typeof computeUnitPrice>["breakdown"];
};

/**
 * Creates a booking inside a transaction with `SELECT ... FOR UPDATE` on the event
 * to serialize concurrent purchasers and prevent overselling.
 */
export async function bookTickets(
  db: Database,
  input: BookTicketsInput,
): Promise<BookTicketsResult> {
  if (input.quantity < 1 || input.quantity > 20) {
    throw new Error("Quantity must be between 1 and 20");
  }

  return db.transaction(async (tx) => {
    const [event] = await tx
      .select()
      .from(events)
      .where(eq(events.id, input.eventId))
      .limit(1)
      .for("update");

    if (!event) {
      throw new EventNotFoundError();
    }

    const remaining = event.totalCapacity - event.bookedTickets;
    if (remaining < input.quantity) {
      throw new InsufficientInventoryError(
        `Only ${remaining} ticket(s) remain for this event.`,
      );
    }

    const windowHours = event.pricingRules.demand.windowHours;
    const bookingsInWindow = await countBookingsInWindow(
      tx,
      input.eventId,
      windowHours,
    );

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
      weights: input.weights,
    });

    const unit = priced.unitPriceCents;
    const total = unit * input.quantity;

    const [inserted] = await tx
      .insert(bookings)
      .values({
        eventId: input.eventId,
        userEmail: input.userEmail,
        quantity: input.quantity,
        totalPricePaidCents: total,
        unitPriceSnapshotCents: unit,
      })
      .returning({ id: bookings.id });

    await tx
      .update(events)
      .set({ bookedTickets: event.bookedTickets + input.quantity })
      .where(eq(events.id, input.eventId));

    return {
      bookingId: inserted!.id,
      unitPriceSnapshotCents: unit,
      totalPricePaidCents: total,
      quantity: input.quantity,
      breakdown: priced.breakdown,
    };
  });
}

export async function listBookingsByEvent(db: Database, eventId: string) {
  return db
    .select()
    .from(bookings)
    .where(eq(bookings.eventId, eventId))
    .orderBy(asc(bookings.createdAt));
}

export async function listBookingsByEmail(db: Database, email: string) {
  return db
    .select({
      booking: bookings,
      eventName: events.name,
      eventStartsAt: events.startsAt,
      eventVenue: events.venue,
    })
    .from(bookings)
    .innerJoin(events, eq(bookings.eventId, events.id))
    .where(eq(bookings.userEmail, email))
    .orderBy(asc(bookings.createdAt));
}

/** Loads a single event (no lock); used for read-only handlers. */
export async function getEventById(
  db: Database,
  id: string,
): Promise<EventRow | undefined> {
  const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return row;
}
