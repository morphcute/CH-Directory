import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
export const SESSION_COOKIE = "ch_organizer_session";
export const SESSION_SECONDS = 60 * 60 * 8;
export const ADMIN_EMAIL = (
  process.env.ADMIN_EMAIL || "lester.chquezonprovince@gmail.com"
)
  .toLowerCase()
  .trim();

export function authConfigured() {
  return (process.env.SESSION_SECRET?.length || 0) >= 32;
}
function signature(value: string) {
  return createHmac("sha256", process.env.SESSION_SECRET || "")
    .update(value)
    .digest("hex");
}
export function equalSecret(a: string, b: string) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}
export function createSession() {
  const expiry = String(Date.now() + SESSION_SECONDS * 1000);
  return `${expiry}.${signature(expiry)}`;
}
export function verifySession(value?: string) {
  if (!authConfigured() || !value) return false;
  const [expiry, sig, extra] = value.split(".");
  return (
    !extra &&
    /^\d+$/.test(expiry) &&
    Number(expiry) > Date.now() &&
    equalSecret(sig || "", signature(expiry))
  );
}
export async function isOrganizer() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  // Next's internal URL may use the bind address (0.0.0.0). Compare the public
  // Host header to the browser's Origin; also works behind an HTTPS proxy.
  try {
    return (
      new URL(origin).host ===
      (request.headers.get("host") || new URL(request.url).host)
    );
  } catch {
    return false;
  }
}
