import { cookies } from "next/headers";
import { openSession, SESSION_COOKIE } from "@/lib/session";

export async function GET() {
  const session = await openSession((await cookies()).get(SESSION_COOKIE)?.value);
  return Response.json({ email: session?.email ?? null });
}
