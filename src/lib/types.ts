export type Provider = "uber" | "rapido";

/** A ride receipt extracted from a single email. */
export interface Receipt {
  /** Gmail message id the receipt came from. */
  messageId: string;
  provider: Provider;
  /** Provider's own trip/ride id when the email shows one. */
  tripId: string | null;
  /** When the ride happened, ISO string. Falls back to the email date. */
  date: string;
  /** Amount in paise, so totals never drift with floating point. */
  amountPaise: number;
  /** Vehicle or ride type, e.g. "Uber Go", "Bike", "Auto". */
  rideType: string | null;
  pickup: string | null;
  drop: string | null;
}

export interface ReceiptWithStatus extends Receipt {
  /** Set when this receipt duplicates an earlier one; holds that receipt's messageId. */
  duplicateOf: string | null;
}

/** The fields of a Gmail message the parsers need. */
export interface EmailInput {
  id: string;
  from: string;
  subject: string;
  /** RFC 2822 date header or ISO string. */
  date: string;
  /** Plain-text body; HTML bodies are converted before parsing. */
  text: string;
}
