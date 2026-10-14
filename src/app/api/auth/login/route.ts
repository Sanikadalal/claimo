import { cookies } from "next/headers";
import { authorizationUrl } from "@/lib/gmail";
import { STATE_COOKIE } from "@/lib/session";

export async function GET() {
  // Random state ties the callback to this browser and blocks forged OAuth responses.
  const state = crypto.randomUUID();
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return Response.redirect(authorizationUrl(state));
}
