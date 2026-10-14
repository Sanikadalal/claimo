const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&rsquo;": "'",
  "&#8377;": "₹",
  "&#x20b9;": "₹",
};

/**
 * Turns receipt HTML into line-oriented text. Block-level tags become line
 * breaks so "Total" and its amount in adjacent table cells stay on nearby lines.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " \t ")
    .replace(/<[^>]+>/g, "")
    .replace(/&[#\w]+;/g, (e) => ENTITIES[e.toLowerCase()] ?? " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

const AMOUNT = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i;

/** Parses "₹1,234.50", "Rs. 120", "INR 99" into paise. Returns null if no amount. */
export function parseAmountPaise(s: string): number | null {
  const m = s.match(AMOUNT);
  if (!m) return null;
  const [rupees, paise = ""] = m[1].replace(/,/g, "").split(".");
  const value = Number(rupees) * 100 + Number(paise.padEnd(2, "0") || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Finds the amount that follows one of the given labels, on the same line or
 * the next one (table layouts often split label and value).
 */
export function amountAfterLabel(text: string, labels: RegExp): number | null {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(labels);
    if (!match) continue;
    const rest = lines[i].slice((match.index ?? 0) + match[0].length);
    const amount = parseAmountPaise(rest) ?? parseAmountPaise(lines[i + 1] ?? "");
    if (amount !== null) return amount;
  }
  return null;
}

/** Value after "Label:" on the same line, or the next line if the label stands alone. */
export function valueAfterLabel(text: string, label: RegExp): string | null {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(label);
    if (!match) continue;
    const rest = lines[i].slice((match.index ?? 0) + match[0].length).replace(/^[\s:|-]+/, "").trim();
    if (rest) return rest;
    if (lines[i + 1]) return lines[i + 1].trim();
  }
  return null;
}

export function toIsoDate(date: string): string {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}
