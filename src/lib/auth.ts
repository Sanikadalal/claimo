import { cookies } from "next/headers";
import { z } from "zod";
import { ensureFreshToken } from "./gmail";
import { openSession, sealSession, SESSION_COOKIE, sessionCookieOptions, type Session } from "./session";

/** Loads the session for a route handler, persisting a refreshed access token if needed. */
export async function requireSession(): Promise<Session | null> {
  const store = await cookies();
  const session = await openSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const { session: fresh, refreshed } = await ensureFreshToken(session);
  if (refreshed) store.set(SESSION_COOKIE, await sealSession(fresh), sessionCookieOptions);
  return fresh;
}

const MAX_RANGE_DAYS = 93;
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const rangeSchema = z
  .object({ from: isoDay, to: isoDay })
  .transform(({ from, to }) => ({
    from: new Date(`${from}T00:00:00+05:30`),
    // The end date is inclusive, so search up to the start of the next day.
    to: new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 24 * 60 * 60 * 1000),
  }))
  .refine(({ from, to }) => to > from, "End date must be on or after start date")
  .refine(
    ({ from, to }) => to.getTime() - from.getTime() <= MAX_RANGE_DAYS * 24 * 60 * 60 * 1000,
    `Pick a range of ${MAX_RANGE_DAYS} days or less`,
  );

export const unauthorized = () => Response.json({ error: "Connect Gmail first" }, { status: 401 });
