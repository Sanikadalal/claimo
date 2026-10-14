import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseEmail, receiptQuery } from "@/lib/parsers";
import { htmlToText, parseAmountPaise } from "@/lib/parsers/text";
import type { EmailInput } from "@/lib/types";

const fixture = (name: string) => htmlToText(readFileSync(join(__dirname, "fixtures", name), "utf8"));

const email = (overrides: Partial<EmailInput>): EmailInput => ({
  id: "m1",
  from: "Uber Receipts <noreply@uber.com>",
  subject: "Your Tuesday evening trip with Uber",
  date: "2026-10-06T17:14:00.000Z",
  text: "",
  ...overrides,
});

describe("parseAmountPaise", () => {
  it.each([
    ["₹245.32", 24532],
    ["Rs. 1,250", 125000],
    ["INR 99.5", 9950],
    ["₹ 56", 5600],
  ])("parses %s", (input, expected) => {
    expect(parseAmountPaise(input)).toBe(expected);
  });

  it("returns null without a currency marker", () => {
    expect(parseAmountPaise("Total 245")).toBeNull();
  });
});

describe("Uber receipts", () => {
  it("extracts total, ride type and route", () => {
    const receipt = parseEmail(email({ text: fixture("uber-go.html") }));
    expect(receipt).toMatchObject({
      provider: "uber",
      amountPaise: 24532,
      rideType: "Uber Go",
      pickup: "Koregaon Park, Pune, Maharashtra 411001",
      drop: "Magarpatta City, Hadapsar, Pune 411028",
    });
  });

  it("ignores Uber Eats orders from the same sender", () => {
    const receipt = parseEmail(
      email({ subject: "Your Uber Eats order with Behrouz Biryani", text: fixture("uber-eats.html") }),
    );
    expect(receipt).toBeNull();
  });

  it("ignores promotional mail with no fare", () => {
    expect(parseEmail(email({ subject: "Your trip discount is waiting", text: "Get 20% off" }))).toBeNull();
  });
});

describe("Rapido receipts", () => {
  it("extracts total, ride id, vehicle and route", () => {
    const receipt = parseEmail(
      email({ from: "Rapido <shoutout@rapido.bike>", subject: "Rapido Ride Receipt", text: fixture("rapido-bike.html") }),
    );
    expect(receipt).toMatchObject({
      provider: "rapido",
      tripId: "RD17283940561234",
      amountPaise: 5600,
      rideType: "Bike",
      pickup: "Baner Road, Pune",
      drop: "Shivajinagar, Pune",
    });
  });
});

it("ignores senders other than Uber and Rapido", () => {
  expect(parseEmail(email({ from: "ola@olacabs.com", text: "Total ₹100" }))).toBeNull();
});

it("builds a Gmail query bounded by epoch seconds", () => {
  const q = receiptQuery(new Date("2026-10-01T00:00:00Z"), new Date("2026-10-15T00:00:00Z"));
  expect(q).toBe("from:(uber.com OR rapido.bike OR rapido.in) after:1790812800 before:1792022400");
});
