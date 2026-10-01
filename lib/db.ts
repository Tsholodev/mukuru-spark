import { readFileSync } from "fs";
import path from "path";
import { Pool, type PoolClient } from "pg";
import { freshLedger } from "./engine";
import { hashSecret } from "./passwords";

export const SENDER_ID = "thandi";
export const RECEIVER_ID = "amai";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: false } : undefined,
});

let ready: Promise<void> | null = null;

export function getPool() {
  return pool;
}

export function withDb<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return readyDb().then(async () => {
    const client = await pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  });
}

export function readyDb() {
  if (!process.env.DATABASE_URL) {
    return Promise.reject(new Error("DATABASE_URL is not set"));
  }
  if (!ready) ready = migrate();
  return ready;
}

async function migrate() {
  const client = await pool.connect();
  try {
    const schema = readFileSync(path.join(process.cwd(), "supabase", "schema.sql"), "utf8");
    await client.query(schema);
    const existing = await client.query("select count(*)::int as n from users");
    if (existing.rows[0].n === 0) await seed(client);
  } finally {
    client.release();
  }
}

async function seed(client: PoolClient) {
  const ledger = freshLedger();
  await client.query("begin");
  try {
    await client.query(
      `insert into users (id, role, name, phone, password_hash, city, lang, card_last4, balance_cents, pin_misses, id_masked)
       values ($1, 'sender', 'Thandi Ncube', '0790001111', $2, 'Johannesburg', 'en', '4419', $3, 0, null),
              ($4, 'receiver', 'Rudo Ncube', '0774418000', $5, 'Harare', 'sn', null, 0, 0, '63-****481-H25')`,
      [SENDER_ID, hashSecret("25802580"), ledger.balanceZarCents, RECEIVER_ID, hashSecret("4418")],
    );
    for (const order of ledger.orders) {
      await client.query(
        `insert into orders (
          ref, sender_id, receiver_id, idempotency_key, quote_id, amount_cents, fee_cents, net_cents,
          usd_cents, rate_milli, payout, pay_with, status, created_at, paid_at, voucher_at, collected_at, recipient_name
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          order.ref,
          SENDER_ID,
          RECEIVER_ID,
          order.idempotencyKey,
          order.quoteId,
          order.amountZarCents,
          order.feeZarCents,
          order.netZarCents,
          order.usdOutCents,
          order.rateMilli,
          order.payout,
          order.payWith,
          order.status,
          order.createdAt,
          order.paidAt,
          order.voucherAt,
          order.collectedAt,
          order.recipientName,
        ],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
