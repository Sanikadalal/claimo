import type { EmailInput, Receipt } from "../types";
import { isRapidoEmail, parseRapido } from "./rapido";
import { isUberEmail, parseUber } from "./uber";

/** Gmail search query that narrows the inbox to ride receipts in a date range. */
export function receiptQuery(from: Date, to: Date): string {
  const after = Math.floor(from.getTime() / 1000);
  const before = Math.floor(to.getTime() / 1000);
  return `from:(uber.com OR rapido.bike OR rapido.in) after:${after} before:${before}`;
}

export function parseEmail(email: EmailInput): Receipt | null {
  if (isUberEmail(email)) return parseUber(email);
  if (isRapidoEmail(email)) return parseRapido(email);
  return null;
}
