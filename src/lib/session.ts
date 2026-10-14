import { EncryptJWT, jwtDecrypt } from "jose";

export const SESSION_COOKIE = "claimo_session";
export const STATE_COOKIE = "claimo_oauth_state";

export interface Session {
  email: string;
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
}

async function key(): Promise<Uint8Array> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  // A256GCM needs exactly 32 bytes; hashing lets the secret be any length.
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)));
}

/** Tokens are encrypted, not just signed, so the cookie never exposes Gmail access. */
export async function sealSession(session: Session): Promise<string> {
  return new EncryptJWT({ ...session })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .encrypt(await key());
}

export async function openSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, await key());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
