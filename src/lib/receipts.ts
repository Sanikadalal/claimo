import { markDuplicates } from "./dedupe";
import { fetchEmails, searchMessageIds } from "./gmail";
import { parseEmail, receiptQuery } from "./parsers";
import type { Receipt, ReceiptWithStatus } from "./types";

export interface ReceiptScan {
  receipts: ReceiptWithStatus[];
  /** Emails matched by the search that did not parse as a ride receipt. */
  skipped: number;
}

/** Searches Gmail for the date range, parses each email, and flags duplicates. */
export async function scanReceipts(from: Date, to: Date, accessToken: string): Promise<ReceiptScan> {
  const ids = await searchMessageIds(receiptQuery(from, to), accessToken);
  const emails = await fetchEmails(ids, accessToken);
  const parsed = emails.map(parseEmail).filter((r): r is Receipt => r !== null);
  return { receipts: markDuplicates(parsed), skipped: emails.length - parsed.length };
}
