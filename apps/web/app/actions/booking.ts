"use server";

import { redirect } from "next/navigation";
import { getServerApiBaseUrl } from "../../lib/env";
import { serverApiFetch } from "../../lib/server-api";

export type BookingActionState =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Submits a booking to the API and redirects to the confirmation route on success.
 */
export async function submitBooking(
  _prev: BookingActionState | undefined,
  formData: FormData,
): Promise<BookingActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const userEmail = String(formData.get("userEmail") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1);

  if (!eventId || !userEmail) {
    return { ok: false, message: "Email and event are required." };
  }

  const res = await serverApiFetch("/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, userEmail, quantity }),
  });

  if (!res) {
    return {
      ok: false,
      message: `Cannot reach the ticketing API at ${getServerApiBaseUrl()}. Start the API or set INTERNAL_API_URL in apps/web/.env.local.`,
    };
  }

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const msg =
      typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : `Booking failed (${res.status})`;
    return { ok: false, message: msg };
  }

  const booking = body.booking as
    | {
        bookingId: string;
        unitPriceSnapshotCents: number;
        totalPricePaidCents: number;
        quantity: number;
      }
    | undefined;

  if (!booking?.bookingId) {
    return { ok: false, message: "Unexpected API response." };
  }

  const params = new URLSearchParams({
    bookingId: booking.bookingId,
    unit: String(booking.unitPriceSnapshotCents),
    total: String(booking.totalPricePaidCents),
    qty: String(booking.quantity),
    eventId,
  });
  redirect(`/bookings/success?${params.toString()}`);
}
