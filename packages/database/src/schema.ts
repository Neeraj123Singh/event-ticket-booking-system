import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  index,
} from "drizzle-orm/pg-core";

/**
 * JSON shape stored on each event to tune dynamic pricing tiers.
 * All `adjustment` values are fractional deltas (e.g. 0.2 = +20% before weights).
 */
export type PricingRulesConfig = {
  /** Sorted by ascending `maxDaysUntilEvent`; first matching tier wins. */
  timeTiers: Array<{
    /** If days until event <= this (or null = default catch-all), apply adjustment. */
    maxDaysUntilEvent: number | null;
    adjustment: number;
  }>;
  demand: {
    /** If bookings in the rolling window exceed this count, apply adjustment. */
    bookingsInWindow: number;
    windowHours: number;
    adjustment: number;
  };
  inventory: {
    /** When remaining fraction (unsold/total) is below this, apply adjustment. */
    whenRemainingFractionBelow: number;
    adjustment: number;
  };
};

/** Events available for booking with capacity and pricing bounds. */
export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    venue: text("venue").notNull(),
    /** When the event starts (used for time-based pricing). */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    totalCapacity: integer("total_capacity").notNull(),
    /**
     * Denormalized sold count; updated only inside booking transactions
     * alongside row-level locks to prevent overselling.
     */
    bookedTickets: integer("booked_tickets").notNull().default(0),
    basePriceCents: integer("base_price_cents").notNull(),
    floorPriceCents: integer("floor_price_cents").notNull(),
    ceilingPriceCents: integer("ceiling_price_cents").notNull(),
    pricingRules: jsonb("pricing_rules").$type<PricingRulesConfig>().notNull(),
    /** Optional flag for homepage / curated lists (extra feature). */
    featured: boolean("featured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("events_starts_at_idx").on(t.startsAt),
    index("events_featured_idx").on(t.featured),
  ],
);

/** Confirmed ticket purchases (payment assumed external). */
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "restrict" }),
    userEmail: text("user_email").notNull(),
    quantity: integer("quantity").notNull(),
    /** Total charged for this line (quantity × unit snapshot). */
    totalPricePaidCents: integer("total_price_paid_cents").notNull(),
    /** Per-ticket price at booking time (after dynamic rules, before quantity). */
    unitPriceSnapshotCents: integer("unit_price_snapshot_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("bookings_event_id_idx").on(t.eventId),
    index("bookings_user_email_idx").on(t.userEmail),
    index("bookings_created_at_idx").on(t.createdAt),
  ],
);

export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
export type BookingRow = typeof bookings.$inferSelect;
export type NewBookingRow = typeof bookings.$inferInsert;
