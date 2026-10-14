import { z } from "zod";
import { rangeSchema, requireSession, unauthorized } from "@/lib/auth";
import { scanReceipts } from "@/lib/receipts";
import { buildReport } from "@/lib/report";

const bodySchema = z.object({
  employeeName: z.string().trim().min(1, "Enter your name").max(80),
  range: rangeSchema,
  messageIds: z.array(z.string()).min(1, "Select at least one receipt").max(300),
});

export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: body.error.issues[0].message }, { status: 400 });

  const session = await requireSession();
  if (!session) return unauthorized();

  // Re-read receipts from Gmail rather than trusting amounts sent by the browser.
  const { from, to } = body.data.range;
  let scan;
  try {
    scan = await scanReceipts(from, to, session.accessToken);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Could not read Gmail" }, { status: 502 });
  }
  const wanted = new Set(body.data.messageIds);
  const receipts = scan.receipts.filter((r) => wanted.has(r.messageId) && r.duplicateOf === null);
  if (receipts.length === 0) return Response.json({ error: "No matching receipts found" }, { status: 404 });

  const pdf = await buildReport({ employeeName: body.data.employeeName, from, to, receipts });
  const fileName = `reimbursement-${from.toISOString().slice(0, 7)}.pdf`;
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
