import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { readyDb, withDb } from "./db";
import { normalizePhone, verifySecret } from "./passwords";

export type Account = {
  id: string;
  role: "sender" | "receiver";
  name: string;
  phone: string;
  city: string;
  lang: "en" | "sn";
};

const COOKIE = "mukuru_session";
const WEEK = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function login(phone: string, secret: string): Promise<Account | null> {
  const normalized = normalizePhone(phone);
  return withDb(async (client) => {
    const found = await client.query(
      "select id, role, name, phone, city, lang, password_hash from users where phone = $1",
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
      path: "/",
      maxAge: WEEK / 1000,
    });
    return {
      id: row.id,
      role: row.role,
      name: row.name,
      phone: row.phone,
      city: row.city,
      lang: row.lang,
    };
  });
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
      `select u.id, u.role, u.name, u.phone, u.city, u.lang
       from sessions s join users u on u.id = s.user_id
       where s.token_hash = $1 and s.expires_at > $2`,
      [hashToken(token), Date.now()],
    );
    return found.rows[0] ?? null;
  });
}

export async function requireAccount(role: Account["role"]) {
  const account = await getSession();
  if (!account || account.role !== role) return null;
  return account;
}

export async function setLanguage(userId: string, lang: "en" | "sn") {
  await withDb((client) => client.query("update users set lang = $2 where id = $1", [userId, lang]));
}
