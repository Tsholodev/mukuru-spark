import { createHash, randomBytes, randomUUID } from "crypto";
import { cookies } from "next/headers";
import { readyDb, withDb } from "./db";
import { hashSecret, normalizePhone, verifySecret } from "./passwords";

export type Account = {
  id: string;
  role: "sender" | "receiver";
  name: string;
  phone: string;
  country: string | null;
  city: string | null;
  lang: "en" | "sn";
  preferredLanguage: "en" | "sn";
};

const COOKIE = "mukuru_session";
const WEEK = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function login(phone: string, secret: string): Promise<Account | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return withDb(async (client) => {
    const found = await client.query(
      "select id, role, name, phone_number, city, country, lang, preferred_language, password_hash from users where phone_number = $1",
      [normalized],
    );
    const row = found.rows[0];
    if (!row || !verifySecret(secret, row.password_hash)) return null;
    const token = randomBytes(32).toString("hex");
    await client.query("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [
      hashToken(token),
      row.id,
      Date.now() + WEEK,
    ]);
    const jar = await cookies();
    jar.set(COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: WEEK / 1000,
    });
    return {
      id: row.id,
      role: row.role,
      name: row.name,
      phone: row.phone_number,
      city: row.city,
      country: row.country,
      lang: row.lang,
      preferredLanguage: row.preferred_language ?? row.lang,
    };
  });
}

export async function registerAccount(input: {
  name: string;
  phone: string;
  country: string;
  city: string;
  role: Account["role"];
  preferredLanguage: Account["lang"];
  password: string;
}): Promise<{ account: Account } | { error: "invalid_phone" | "phone_in_use" | "invalid_account" }> {
  const name = input.name.trim();
  const country = input.country.toUpperCase();
  const phone = normalizePhone(input.phone, country);
  const city = input.city.trim();
  if (!name || name.length > 100 || !city || city.length > 100 || !phone || input.password.length < 8 || input.password.length > 128) {
    return { error: "invalid_account" };
  }
  if (input.role !== "sender" && input.role !== "receiver") return { error: "invalid_account" };
  if (input.preferredLanguage !== "en" && input.preferredLanguage !== "sn") return { error: "invalid_account" };

  try {
    await withDb((client) =>
      client.query(
        `insert into users (
          id, role, name, phone, phone_number, password_hash, city, country, lang, preferred_language,
          balance_cents, pin_misses
        ) values ($1, $2, $3, $4, $4, $5, $6, $7, $8, $8, 0, 0)`,
        [randomUUID(), input.role, name, phone, hashSecret(input.password), city, country, input.preferredLanguage],
      ),
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return { error: "phone_in_use" };
    }
    throw error;
  }

  const account = await login(phone, input.password);
  return account ? { account } : { error: "invalid_account" };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await withDb((client) => client.query("delete from sessions where token_hash = $1", [hashToken(token)]));
  }
  jar.delete(COOKIE);
}

export async function getSession(): Promise<Account | null> {
  await readyDb();
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return withDb(async (client) => {
    const found = await client.query(
      `select u.id, u.role, u.name, u.phone_number as phone, u.city, u.country,
              coalesce(u.preferred_language, u.lang) as preferred_language
       from sessions s join users u on u.id = s.user_id
       where s.token_hash = $1 and s.expires_at > $2`,
      [hashToken(token), Date.now()],
    );
    const row = found.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      role: row.role,
      name: String(row.name),
      phone: String(row.phone),
      city: row.city == null ? null : String(row.city),
      country: row.country == null ? null : String(row.country),
      lang: row.preferred_language === "sn" ? "sn" : "en",
      preferredLanguage: row.preferred_language === "sn" ? "sn" : "en",
    };
  });
}

export async function requireAccount(role: Account["role"]) {
  const account = await getSession();
  if (!account || account.role !== role) return null;
  return account;
}

export async function setLanguage(userId: string, lang: "en" | "sn") {
  await withDb((client) =>
    client.query("update users set lang = $2, preferred_language = $2 where id = $1", [userId, lang]),
  );
}
