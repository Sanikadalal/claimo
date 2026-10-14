import type { EmailInput, Receipt } from "../types";
import { amountAfterLabel, toIsoDate } from "./text";

const RIDE_TYPES = [
  "Uber Go",
  "Go Sedan",
  "Go Intercity",
  "Premier",
  "Uber XL",
  "UberXL",
  "Uber Auto",
  "Auto",
  "Moto",
  "Uber Green",
  "Intercity",
];

const TIME_LINE = /^\d{1,2}:\d{2}\s*(?:am|pm)?$/i;

export function isUberEmail(email: EmailInput): boolean {
  return /uber\.com/i.test(email.from);
}

export function parseUber(email: EmailInput): Receipt | null {
  // Uber Eats, promos and account mails share the sender; only trip receipts count.
  if (/eats|order|promo|offer/i.test(email.subject)) return null;
  if (!/trip|ride|receipt/i.test(email.subject)) return null;

  const text = email.text;
  const amountPaise = amountAfterLabel(text, /\b(?:total|amount charged|you paid)\b/i);
  if (amountPaise === null) return null;

  const lines = text.split("\n");
  const rideType =
    RIDE_TYPES.find((type) => lines.some((line) => line.toLowerCase().startsWith(type.toLowerCase()))) ?? null;

  // The route block lists "time" then "address" for pickup and again for drop.
  const stops: string[] = [];
  for (let i = 0; i < lines.length - 1 && stops.length < 2; i++) {
    if (TIME_LINE.test(lines[i])) stops.push(lines[i + 1]);
  }

  return {
    messageId: email.id,
    provider: "uber",
    tripId: null,
    date: toIsoDate(email.date),
    amountPaise,
    rideType,
    pickup: stops[0] ?? null,
    drop: stops[1] ?? null,
  };
}
