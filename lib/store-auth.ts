import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "senda_store_session";
const SESSION_MS = 8 * 60 * 60 * 1000;

function storeSecret() {
  const secret = process.env.STORE_AGENT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "senda-local-store-agent";
  throw new Error("STORE_AGENT_SECRET is required in production.");
}

function sign(payload: string) {
  return createHmac("sha256", storeSecret()).update(payload).digest("hex");
}

export async function createStoreAgentSession() {
  const expiresAt = Date.now() + SESSION_MS;
  const payload = `${expiresAt}.${randomBytes(24).toString("hex")}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
}

export async function hasStoreAgentSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  const [expiresAtText, nonce, signature, extra] = token.split(".");
  if (!expiresAtText || !nonce || !signature || extra) return false;
  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return false;
  const payload = `${expiresAtText}.${nonce}`;
  const actual = Buffer.from(signature, "hex");
  const expected = Buffer.from(sign(payload), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function clearStoreAgentSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}