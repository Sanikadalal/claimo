import type { Receipt, ReceiptWithStatus } from "./types";

/** Two receipts for the same fare this close together are treated as one ride. */
const SAME_RIDE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Flags duplicates: the same message seen twice, the same provider trip id, or
 * the same provider and amount within a few minutes (forwarded or resent
 * receipts). The earliest receipt is kept; later ones point at it.
 */
export function markDuplicates(receipts: Receipt[]): ReceiptWithStatus[] {
  const sorted = [...receipts].sort((a, b) => a.date.localeCompare(b.date));
  const kept: Receipt[] = [];
  const seenMessages = new Set<string>();
  const seenTrips = new Map<string, string>();

  return sorted.map((receipt) => {
    let duplicateOf: string | null = null;

    if (seenMessages.has(receipt.messageId)) {
      duplicateOf = receipt.messageId;
    } else if (receipt.tripId && seenTrips.has(`${receipt.provider}:${receipt.tripId}`)) {
      duplicateOf = seenTrips.get(`${receipt.provider}:${receipt.tripId}`)!;
    } else {
      const time = Date.parse(receipt.date);
      const match = kept.find(
        (k) =>
          k.provider === receipt.provider &&
          k.amountPaise === receipt.amountPaise &&
          Math.abs(Date.parse(k.date) - time) <= SAME_RIDE_WINDOW_MS,
      );
      duplicateOf = match?.messageId ?? null;
    }

    seenMessages.add(receipt.messageId);
    if (duplicateOf === null) {
      kept.push(receipt);
      if (receipt.tripId) seenTrips.set(`${receipt.provider}:${receipt.tripId}`, receipt.messageId);
    }
    return { ...receipt, duplicateOf };
  });
}

export function totalPaise(receipts: Receipt[]): number {
  return receipts.reduce((sum, r) => sum + r.amountPaise, 0);
}

export function formatInr(paise: number): string {
  return (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
