import type { NextRequest } from "next/server";
import { rangeSchema, requireSession, unauthorized } from "@/lib/auth";
import { scanReceipts } from "@/lib/receipts";

export async function GET(request: NextRequest) {
  const range = rangeSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!range.success) return Response.json({ error: range.error.issues[0].message }, { status: 400 });

  const session = await requireSession();
  if (!session) return unauthorized();

  try {
    const started = performance.now();
    const scan = await scanReceipts(range.data.from, range.data.to, session.accessToken);
    return Response.json({ ...scan, tookMs: Math.round(performance.now() - started) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Scan failed" }, { status: 502 });
  }
}
