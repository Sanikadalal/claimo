import { htmlToText } from "./parsers/text";
import type { Session } from "./session";
import type { EmailInput } from "./types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly"];

/** Cap per search so one huge inbox cannot stall a request. */
const MAX_MESSAGES = 300;
const FETCH_CONCURRENCY = 8;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const redirectUri = () => `${env("APP_URL")}/api/auth/callback`;

export function authorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Google token request failed: ${res.status}`);
  return res.json();
}

export async function exchangeCode(code: string): Promise<Session> {
  const tokens = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!tokens.refresh_token || !tokens.id_token) throw new Error("Google did not return a refresh token");
  // The id_token comes straight from Google's token endpoint over TLS, so reading its claims is safe here.
  const claims = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString());
  return {
    email: claims.email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
}

/** Returns a session with a valid access token, refreshing it if it is about to expire. */
export async function ensureFreshToken(session: Session): Promise<{ session: Session; refreshed: boolean }> {
  if (session.expiresAt - Date.now() > 60_000) return { session, refreshed: false };
  const tokens = await tokenRequest({ refresh_token: session.refreshToken, grant_type: "refresh_token" });
  return {
    session: { ...session, accessToken: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 },
    refreshed: true,
  };
}

async function gmail<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${GMAIL}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 401) throw new Error("Gmail access expired, please reconnect");
  if (!res.ok) throw new Error(`Gmail request failed: ${res.status}`);
  return res.json();
}

interface MessagePart {
  mimeType: string;
  body?: { data?: string };
  parts?: MessagePart[];
}

interface GmailMessage {
  id: string;
  internalDate: string;
  payload: MessagePart & { headers: { name: string; value: string }[] };
}

/** Walks the MIME tree; prefers HTML because receipt tables lose structure in the text part. */
function extractBody(part: MessagePart): string {
  const found: Record<string, string> = {};
  const walk = (p: MessagePart) => {
    if (p.body?.data && (p.mimeType === "text/html" || p.mimeType === "text/plain")) {
      found[p.mimeType] ??= Buffer.from(p.body.data, "base64url").toString("utf8");
    }
    p.parts?.forEach(walk);
  };
  walk(part);
  if (found["text/html"]) return htmlToText(found["text/html"]);
  return found["text/plain"] ?? "";
}

export async function searchMessageIds(query: string, accessToken: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q: query, maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(
      `/messages?${params}`,
      accessToken,
    );
    ids.push(...(page.messages ?? []).map((m) => m.id));
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < MAX_MESSAGES);
  return ids.slice(0, MAX_MESSAGES);
}

export async function fetchEmail(id: string, accessToken: string): Promise<EmailInput> {
  const msg = await gmail<GmailMessage>(`/messages/${id}?format=full`, accessToken);
  const header = (name: string) =>
    msg.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  return {
    id: msg.id,
    from: header("From"),
    subject: header("Subject"),
    // internalDate is when Gmail received it, which is more reliable than the Date header.
    date: new Date(Number(msg.internalDate)).toISOString(),
    text: extractBody(msg.payload),
  };
}

/** Fetches messages with bounded concurrency to stay inside Gmail's per-user rate limits. */
export async function fetchEmails(ids: string[], accessToken: string): Promise<EmailInput[]> {
  const results: EmailInput[] = new Array(ids.length);
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const i = next++;
      results[i] = await fetchEmail(ids[i], accessToken);
    }
  };
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, ids.length) }, worker));
  return results;
}
