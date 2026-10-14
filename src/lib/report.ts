import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatInr, totalPaise } from "./dedupe";
import type { Receipt } from "./types";

export interface ReportInput {
  employeeName: string;
  from: Date;
  to: Date;
  receipts: Receipt[];
}

const PAGE = { width: 595.28, height: 841.89 }; // A4
const MARGIN = 48;
const ROW_HEIGHT = 18;
const COLUMNS = [
  { label: "Date", width: 70 },
  { label: "Provider", width: 55 },
  { label: "Ride", width: 65 },
  { label: "Route", width: 220 },
  { label: "Amount (INR)", width: 89, alignRight: true },
];
const GREY = rgb(0.45, 0.45, 0.45);
const LINE = rgb(0.85, 0.85, 0.85);

const providerName = (p: Receipt["provider"]) => (p === "uber" ? "Uber" : "Rapido");
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** Standard PDF fonts only cover WinAnsi, so strip anything they cannot draw. */
const safe = (s: string) => s.replace(/[^\x20-\x7E]/g, "").trim();

function fit(text: string, font: PDFFont, size: number, width: number): string {
  let out = safe(text);
  if (font.widthOfTextAtSize(out, size) <= width) return out;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}...`, size) > width) out = out.slice(0, -1);
  return `${out}...`;
}

/** Builds a reimbursement-ready PDF: summary, per-provider totals, and an itemised table. */
export async function buildReport({ employeeName, from, to, receipts }: ReportInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Travel reimbursement - ${safe(employeeName)}`);
  doc.setCreator("Claimo");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const sorted = [...receipts].sort((a, b) => a.date.localeCompare(b.date));

  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  const text = (p: PDFPage, s: string, x: number, yy: number, size = 10, f = font, color = rgb(0, 0, 0)) =>
    p.drawText(safe(s), { x, y: yy, size, font: f, color });

  text(page, "Travel Reimbursement Report", MARGIN, y, 18, bold);
  y -= 24;
  text(page, `Employee: ${employeeName}`, MARGIN, y, 10);
  y -= 14;
  text(page, `Period: ${formatDate(from.toISOString())} to ${formatDate(to.toISOString())}`, MARGIN, y, 10);
  y -= 14;
  text(page, `Generated: ${formatDate(new Date().toISOString())}`, MARGIN, y, 10, font, GREY);
  y -= 28;

  // Summary block
  text(page, "Summary", MARGIN, y, 12, bold);
  y -= 18;
  const summary: [string, string][] = [["Total rides", String(sorted.length)]];
  for (const provider of ["uber", "rapido"] as const) {
    const rides = sorted.filter((r) => r.provider === provider);
    if (rides.length) summary.push([`${providerName(provider)} (${rides.length})`, `INR ${formatInr(totalPaise(rides))}`]);
  }
  summary.push(["Total claimed", `INR ${formatInr(totalPaise(sorted))}`]);
  for (const [label, value] of summary) {
    const isTotal = label === "Total claimed";
    text(page, label, MARGIN, y, 10, isTotal ? bold : font);
    text(page, value, MARGIN + 160, y, 10, isTotal ? bold : font);
    y -= 15;
  }
  y -= 16;

  const drawHeader = () => {
    let x = MARGIN;
    for (const col of COLUMNS) {
      const w = bold.widthOfTextAtSize(col.label, 9);
      text(page, col.label, col.alignRight ? x + col.width - w : x, y, 9, bold);
      x += col.width;
    }
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.width - MARGIN, y }, thickness: 0.8 });
    y -= ROW_HEIGHT - 4;
  };
  drawHeader();

  for (const r of sorted) {
    if (y < MARGIN + 40) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
      drawHeader();
    }
    const route = r.pickup || r.drop ? `${r.pickup ?? "?"} -> ${r.drop ?? "?"}` : "-";
    const cells = [formatDate(r.date), providerName(r.provider), r.rideType ?? "-", route, formatInr(r.amountPaise)];
    let x = MARGIN;
    cells.forEach((cell, i) => {
      const col = COLUMNS[i];
      const value = fit(cell, font, 9, col.width - 6);
      const w = font.widthOfTextAtSize(value, 9);
      text(page, value, col.alignRight ? x + col.width - w : x, y, 9);
      x += col.width;
    });
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.width - MARGIN, y }, thickness: 0.4, color: LINE });
    y -= ROW_HEIGHT - 6;
  }

  y -= 6;
  const totalLabel = `Total: INR ${formatInr(totalPaise(sorted))}`;
  text(page, totalLabel, PAGE.width - MARGIN - bold.widthOfTextAtSize(totalLabel, 11), y, 11, bold);

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `Page ${i + 1} of ${pages.length}  |  Source receipts: Gmail (Uber, Rapido)`;
    text(p, label, MARGIN, MARGIN / 2, 8, font, GREY);
  });

  return doc.save();
}
