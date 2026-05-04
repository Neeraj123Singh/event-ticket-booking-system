import express, { type Express } from "express";
import cors from "cors";
import { asc, sql } from "drizzle-orm";
import { events, runDemoSeed } from "@repo/database";
import { config } from "../config";
import { getDb } from "../db";
import { requireAdminKey } from "../middleware/adminAuth";
import {
  bookTickets,
  EventNotFoundError,
  getEventById,
  InsufficientInventoryError,
  listBookingsByEmail,
  listBookingsByEvent,
} from "../services/bookingService";
import {
  analyticsForEvent,
  analyticsSummary,
  createEvent,
  defaultPricingRules,
  listUpcomingEvents,
} from "../services/eventService";
import { livePriceForEvent } from "./pricingHelpers";
import { bookingBodySchema, createEventBodySchema } from "./schemas";

/**
 * Builds the Express application with all REST routes and global middleware.
 */
export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "256kb" }));

  const weights = () => config.pricingWeights;

  /** Root URL — browsers and `curl` often hit `/` first; avoid a bare 404. */
  app.get("/", (_req, res) => {
    res.json({
      service: "ticketing-api",
      docs: "See repo README for REST routes.",
      routes: {
        health: "GET /health",
        events: "GET /events",
        eventById: "GET /events/:id",
        book: "POST /bookings",
        bookingsByEvent: "GET /bookings?eventId=",
        bookingsByEmail: "GET /bookings/by-email?email=",
        analyticsEvent: "GET /analytics/events/:id",
        analyticsSummary: "GET /analytics/summary",
        seed: "POST /seed (admin)",
        createEvent: "POST /events (admin)",
      },
    });
  });

  /** Liveness + optional DB ping for orchestrators (extra feature beyond spec). */
  app.get("/health", async (_req, res) => {
    try {
      const db = getDb();
      await db.execute(sql`select 1`);
      res.json({
        status: "ok",
        database: "up",
        uptimeSeconds: Math.floor(process.uptime()),
      });
    } catch {
      res.status(503).json({ status: "degraded", database: "down" });
    }
  });

  app.get("/events", async (req, res) => {
    const db = getDb();
    const search = typeof req.query.q === "string" ? req.query.q : undefined;
    const featuredOnly = req.query.featured === "true";
    const rows = await listUpcomingEvents(db, { search, featuredOnly });
    const out = await Promise.all(
      rows.map(async (event) => {
        const priced = await livePriceForEvent(db, event, weights());
        return {
          id: event.id,
          name: event.name,
          venue: event.venue,
          startsAt: event.startsAt,
          featured: event.featured,
          currentUnitPriceCents: priced.unitPriceCents,
          remaining: event.totalCapacity - event.bookedTickets,
          totalCapacity: event.totalCapacity,
        };
      }),
    );
    res.json({ events: out });
  });

  app.get("/events/:id", async (req, res) => {
    const db = getDb();
    const event = await getEventById(db, req.params.id!);
    if (!event) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const priced = await livePriceForEvent(db, event, weights());
    res.json({
      event: {
        id: event.id,
        name: event.name,
        description: event.description,
        venue: event.venue,
        startsAt: event.startsAt,
        totalCapacity: event.totalCapacity,
        bookedTickets: event.bookedTickets,
        remaining: event.totalCapacity - event.bookedTickets,
        basePriceCents: event.basePriceCents,
        floorPriceCents: event.floorPriceCents,
        ceilingPriceCents: event.ceilingPriceCents,
        featured: event.featured,
        currentUnitPriceCents: priced.unitPriceCents,
        pricingRules: event.pricingRules,
      },
      priceBreakdown: {
        basePriceCents: event.basePriceCents,
        lines: priced.breakdown,
        appliedFactor:
          1 +
          priced.breakdown.reduce(
            (acc, l) => acc + l.weightedAdjustment,
            0,
          ),
      },
    });
  });

  app.post("/events", requireAdminKey, async (req, res) => {
    const parsed = createEventBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
      return;
    }
    const b = parsed.data;
    if (b.floorPriceCents > b.basePriceCents || b.basePriceCents > b.ceilingPriceCents) {
      res.status(400).json({
        error: "Invalid pricing bounds",
        message: "Require floor <= base <= ceiling (in cents).",
      });
      return;
    }
    if (b.bookedTickets > b.totalCapacity) {
      res.status(400).json({ error: "bookedTickets cannot exceed totalCapacity" });
      return;
    }
    const db = getDb();
    const inserted = await createEvent(db, {
      name: b.name,
      description: b.description,
      venue: b.venue,
      startsAt: new Date(b.startsAt),
      totalCapacity: b.totalCapacity,
      bookedTickets: b.bookedTickets,
      basePriceCents: b.basePriceCents,
      floorPriceCents: b.floorPriceCents,
      ceilingPriceCents: b.ceilingPriceCents,
      pricingRules: b.pricingRules ?? defaultPricingRules(),
      featured: b.featured,
    });
    res.status(201).json({ event: inserted });
  });

  app.post("/bookings", async (req, res) => {
    const parsed = bookingBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
      return;
    }
    const db = getDb();
    try {
      const result = await bookTickets(db, {
        ...parsed.data,
        weights: weights(),
      });
      res.status(201).json({ booking: result });
    } catch (e) {
      if (e instanceof EventNotFoundError) {
        res.status(404).json({ error: e.message });
        return;
      }
      if (e instanceof InsufficientInventoryError) {
        res.status(409).json({ error: "Sold out", message: e.message });
        return;
      }
      throw e;
    }
  });

  app.get("/bookings", async (req, res) => {
    const eventId = req.query.eventId;
    if (typeof eventId !== "string" || !eventId) {
      res.status(400).json({ error: "eventId query parameter is required" });
      return;
    }
    const db = getDb();
    const rows = await listBookingsByEvent(db, eventId);
    res.json({ bookings: rows });
  });

  /** Lists bookings for an email (supports the web "My bookings" page). */
  app.get("/bookings/by-email", async (req, res) => {
    const email = req.query.email;
    if (typeof email !== "string" || !email) {
      res.status(400).json({ error: "email query parameter is required" });
      return;
    }
    const db = getDb();
    const rows = await listBookingsByEmail(db, email);
    const enriched = await Promise.all(
      rows.map(async (row) => {
        const ev = await getEventById(db, row.booking.eventId);
        const current = ev
          ? await livePriceForEvent(db, ev, weights())
          : null;
        return {
          ...row.booking,
          eventName: row.eventName,
          eventVenue: row.eventVenue,
          eventStartsAt: row.eventStartsAt,
          currentUnitPriceCents: current?.unitPriceCents ?? null,
        };
      }),
    );
    res.json({ bookings: enriched });
  });

  app.get("/analytics/events/:id", async (req, res) => {
    const db = getDb();
    const metrics = await analyticsForEvent(db, req.params.id!, weights());
    if (!metrics) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(metrics);
  });

  app.get("/analytics/summary", async (_req, res) => {
    const db = getDb();
    res.json(await analyticsSummary(db));
  });

  /**
   * CSV export of per-event rollups (extra feature): easy spreadsheet analysis.
   */
  app.get("/analytics/export.csv", requireAdminKey, async (_req, res) => {
    const db = getDb();
    const all = await db.select().from(events).orderBy(asc(events.startsAt));
    const lines = ["eventId,name,startsAt,totalSold,revenueCents,remaining,currentUnitPriceCents"];
    for (const ev of all) {
      const m = await analyticsForEvent(db, ev.id, weights());
      if (!m) continue;
      lines.push(
        [
          ev.id,
          JSON.stringify(ev.name),
          ev.startsAt.toISOString(),
          m.totalSold,
          m.revenueCents,
          m.remaining,
          m.currentUnitPriceCents,
        ].join(","),
      );
    }
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.send(lines.join("\n"));
  });

  app.post("/seed", requireAdminKey, async (_req, res) => {
    const db = getDb();
    const { eventsInserted } = await runDemoSeed(db);
    res.json({ ok: true, eventsInserted });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next;
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
