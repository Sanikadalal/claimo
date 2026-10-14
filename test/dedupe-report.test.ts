import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { formatInr, markDuplicates, totalPaise } from "@/lib/dedupe";
import { buildReport } from "@/lib/report";
import type { Receipt } from "@/lib/types";

const receipt = (overrides: Partial<Receipt>): Receipt => ({
  messageId: "m1",
  provider: "uber",
  tripId: null,
  date: "2026-10-06T10:00:00.000Z",
  amountPaise: 24532,
  rideType: "Uber Go",
  pickup: "Koregaon Park",
  drop: "Magarpatta",
  ...overrides,
});

describe("markDuplicates", () => {
  it("flags a resent receipt with the same fare a few minutes later", () => {
    const result = markDuplicates([
      receipt({ messageId: "b", date: "2026-10-06T10:04:00.000Z" }),
      receipt({ messageId: "a" }),
    ]);
    expect(result.map((r) => [r.messageId, r.duplicateOf])).toEqual([
      ["a", null],
      ["b", "a"],
    ]);
  });

  it("keeps two genuine rides with the same fare hours apart", () => {
    const result = markDuplicates([
      receipt({ messageId: "a" }),
      receipt({ messageId: "b", date: "2026-10-06T19:00:00.000Z" }),
    ]);
    expect(result.every((r) => r.duplicateOf === null)).toBe(true);
  });

  it("flags the same Rapido ride id regardless of time", () => {
    const result = markDuplicates([
      receipt({ messageId: "a", provider: "rapido", tripId: "RD1234567" }),
      receipt({ messageId: "b", provider: "rapido", tripId: "RD1234567", date: "2026-10-08T10:00:00.000Z", amountPaise: 5600 }),
    ]);
    expect(result[1].duplicateOf).toBe("a");
  });

  it("does not match across providers", () => {
    const result = markDuplicates([receipt({ messageId: "a" }), receipt({ messageId: "b", provider: "rapido" })]);
    expect(result.every((r) => r.duplicateOf === null)).toBe(true);
  });
});

describe("totals", () => {
  it("sums in paise without floating point drift", () => {
    const rides = Array.from({ length: 10 }, (_, i) => receipt({ messageId: String(i), amountPaise: 10 }));
    expect(totalPaise(rides)).toBe(100);
    expect(formatInr(123456)).toBe("1,234.56");
  });
});

describe("buildReport", () => {
  it("produces a valid PDF that paginates long reports", async () => {
    const receipts = Array.from({ length: 80 }, (_, i) =>
      receipt({ messageId: `m${i}`, date: new Date(Date.UTC(2026, 9, 1, i)).toISOString() }),
    );
    const bytes = await buildReport({
      employeeName: "Sanika Dalal",
      from: new Date("2026-10-01"),
      to: new Date("2026-10-31"),
      receipts,
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(doc.getTitle()).toBe("Travel reimbursement - Sanika Dalal");
  });

  it("strips characters the PDF font cannot encode", async () => {
    const bytes = await buildReport({
      employeeName: "Sanika ₹ Dalal",
      from: new Date("2026-10-01"),
      to: new Date("2026-10-31"),
      receipts: [receipt({ pickup: "कोरेगाव पार्क" })],
    });
    expect(bytes.length).toBeGreaterThan(0);
  });
});
