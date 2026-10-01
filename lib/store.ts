import type { PoolClient } from "pg";
import { freshLedger, type Ledger, type Order, type Payout, type PayWith, type Quote } from "./engine";
import { RECEIVER_ID, SENDER_ID, withDb } from "./db";

let queue: Promise<unknown> = Promise.resolve();

function mapQuote(row: Record<string, unknown>): Quote {
  return {
    id: String(row.id),
    amountZarCents: Number(row.amount_cents),
    feeZarCents: Number(row.fee_cents),
    netZarCents: Number(row.net_cents),
    usdOutCents: Number(row.usd_cents),
    midUsdCents: Number(row.mid_usd_cents),
    rateMilli: Number(row.rate_milli),
    midMilli: Number(row.mid_milli),
    payout: row.payout as Payout,
    createdAt: Number(row.created_at),
    lockedUntil: Number(row.locked_until),
    consumedBy: row.consumed_by ? String(row.consumed_by) : null,
  };
}

function mapOrder(row: Record<string, unknown>): Order {
  return {
    ref: String(row.ref),
    idempotencyKey: String(row.idempotency_key),
    quoteId: String(row.quote_id),
    amountZarCents: Number(row.amount_cents),
    feeZarCents: Number(row.fee_cents),
    netZarCents: Number(row.net_cents),
    usdOutCents: Number(row.usd_cents),
    rateMilli: Number(row.rate_milli),
    payout: row.payout as Payout,
    payWith: row.pay_with as PayWith,
    status: row.status as Order["status"],
    createdAt: Number(row.created_at),
    paidAt: row.paid_at == null ? null : Number(row.paid_at),
    voucherAt: row.voucher_at == null ? null : Number(row.voucher_at),
    collectedAt: row.collected_at == null ? null : Number(row.collected_at),
    recipientName: String(row.recipient_name),
  };
}

async function read(client: PoolClient): Promise<Ledger> {
  const account = await client.query("select balance_cents, pin_misses from users where id = $1", [SENDER_ID]);
  const quotes = await client.query("select * from quotes order by created_at asc");
  const orders = await client.query("select * from orders order by created_at desc");
  return {
    balanceZarCents: Number(account.rows[0]?.balance_cents ?? 0),
    pinMisses: Number(account.rows[0]?.pin_misses ?? 0),
    quotes: quotes.rows.map(mapQuote),
    orders: orders.rows.map(mapOrder),
  };
}

async function write(client: PoolClient, ledger: Ledger) {
  await client.query("begin");
  try {
    await client.query("update users set balance_cents = $2, pin_misses = $3 where id = $1", [
      SENDER_ID,
      ledger.balanceZarCents,
      ledger.pinMisses,
    ]);
    await client.query("delete from quotes");
    await client.query("delete from orders");
    for (const quote of ledger.quotes) {
      await client.query(
        `insert into quotes (
          id, sender_id, amount_cents, fee_cents, net_cents, usd_cents, mid_usd_cents, rate_milli, mid_milli,
          payout, created_at, locked_until, consumed_by
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          quote.id,
          SENDER_ID,
          quote.amountZarCents,
          quote.feeZarCents,
          quote.netZarCents,
          quote.usdOutCents,
          quote.midUsdCents,
          quote.rateMilli,
          quote.midMilli,
          quote.payout,
          quote.createdAt,
          quote.lockedUntil,
          quote.consumedBy,
        ],
      );
    }
    for (const order of ledger.orders) {
      await client.query(
        `insert into orders (
          ref, sender_id, receiver_id, idempotency_key, quote_id, amount_cents, fee_cents, net_cents, usd_cents,
          rate_milli, payout, pay_with, status, created_at, paid_at, voucher_at, collected_at, recipient_name
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

export function updateLedger<T>(fn: (ledger: Ledger) => { ledger: Ledger; result: T }): Promise<T> {
  const run = queue.then(() =>
    withDb(async (client) => {
      const current = await read(client);
      const { ledger, result } = fn(current);
      await write(client, ledger);
      return result;
    }),
  );
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function readLedger(): Promise<Ledger> {
  const run = queue.then(() => withDb(read));
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function resetLedger(): Promise<Ledger> {
  return updateLedger(() => {
    const ledger = freshLedger();
    return { ledger, result: ledger };
  });
}
