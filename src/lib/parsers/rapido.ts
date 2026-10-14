import type { EmailInput, Receipt } from "../types";
import { amountAfterLabel, toIsoDate, valueAfterLabel } from "./text";

export function isRapidoEmail(email: EmailInput): boolean {
  return /rapido\.(bike|in|com)/i.test(email.from);
}

export function parseRapido(email: EmailInput): Receipt | null {
  if (!/ride|invoice|receipt|trip/i.test(email.subject)) return null;

  const text = email.text;
  const amountPaise = amountAfterLabel(
    text,
    /\b(?:total amount|total fare|amount paid|grand total|total)\b/i,
  );
  if (amountPaise === null) return null;

  const tripId = text.match(/\b(RD\d{6,})\b/)?.[1] ?? null;
  const rideType = text.match(/\b(Bike Lite|Bike|Auto|Cab Economy|Cab Premium|Cab)\b/)?.[1] ?? null;

  return {
    messageId: email.id,
    provider: "rapido",
    tripId,
    date: toIsoDate(email.date),
    amountPaise,
    rideType,
    pickup: valueAfterLabel(text, /^pick\s?up(?: location)?\b/im),
    drop: valueAfterLabel(text, /^drop(?: location)?\b/im),
  };
}
