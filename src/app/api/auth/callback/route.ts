import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { exchangeCode } from "@/lib/gmail";
import { sealSession, SESSION_COOKIE, sessionCookieOptions, STATE_COOKIE } from "@/lib/session";

export async function GET(request: NextRequest) {
  const store = await cookies();
  const params = request.nextUrl.searchParams;
  const expected = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);

  const home = new URL("/", request.nextUrl);
  const code = params.get("code");
  if (!code || !expected || params.get("state") !== expected) {
    home.searchParams.set("error", params.get("error") ?? "Sign-in was cancelled or expired");
    return Response.redirect(home);
  }

  try {
    const session = await exchangeCode(code);
    store.set(SESSION_COOKIE, await sealSession(session), sessionCookieOptions);
  } catch (err) {
    home.searchParams.set("error", err instanceof Error ? err.message : "Could not connect Gmail");
  }
  return Response.redirect(home);
}
