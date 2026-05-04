import { z } from "zod";
import type { PricingRulesConfig } from "@repo/database";

const pricingRulesSchema: z.ZodType<PricingRulesConfig> = z.object({
  timeTiers: z.array(
    z.object({
      maxDaysUntilEvent: z.number().nullable(),
      adjustment: z.number(),
    }),
  ),
  demand: z.object({
    bookingsInWindow: z.number().int().nonnegative(),
    windowHours: z.number().positive(),
    adjustment: z.number(),
  }),
  inventory: z.object({
    whenRemainingFractionBelow: z.number().min(0).max(1),
    adjustment: z.number(),
  }),
});

export const createEventBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(""),
  venue: z.string().min(1).max(300),
  /** ISO-8601 string; parsed with `new Date()` on the server. */
  startsAt: z.string().min(1),
  totalCapacity: z.number().int().positive().max(1_000_000),
  bookedTickets: z.number().int().nonnegative().optional().default(0),
  basePriceCents: z.number().int().positive(),
  floorPriceCents: z.number().int().positive(),
  ceilingPriceCents: z.number().int().positive(),
  pricingRules: pricingRulesSchema.optional(),
  featured: z.boolean().optional().default(false),
});

export const bookingBodySchema = z.object({
  eventId: z.string().uuid(),
  userEmail: z.string().email(),
  quantity: z.number().int().min(1).max(20),
});
