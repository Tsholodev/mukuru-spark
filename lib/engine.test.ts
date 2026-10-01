import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addQuote,
  buildQuote,
  feeZarCents,
  freshLedger,
  markCollected,
  markPaid,
  placeOrder,
  usdCentsFromNet,
  type Ledger,
  type PayWith,
  type Payout,
} from "./engine.ts";

const NOW = Date.UTC(2026, 9, 1, 7, 30, 0);

function refs() {
  let i = 0;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return () => {
    const char = alphabet[i % alphabet.length];
    i += 1;
    return `MUK-BBBB${char}`;
  };
}

function quoted(amount: number, payout: Payout, id = "q1") {
  const ledger = freshLedger();
  const built = buildQuote(amount, payout, NOW, id);
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error("quote failed");
  return addQuote(ledger, built.quote);
}

function pay(
  ledger: Ledger,
  quoteId: string,
  key: string,
  payWith: PayWith,
  pin = "2580",
  now = NOW,
) {
  return placeOrder(ledger, { quoteId, pin, idempotencyKey: key, payWith }, now, refs());
}

describe("pricing", () => {
  it("keeps the fee inside a R2 000 wallet send and floors the dollars", () => {
    assert.equal(feeZarCents(200_000, "wallet"), 7_900);
    assert.equal(feeZarCents(200_000, "cash"), 9_400);
    assert.equal(usdCentsFromNet(192_100, 17850), 10_761);
    const built = buildQuote(200_000, "wallet", NOW, "q");
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.quote.usdOutCents, 10_761);
    assert.ok(built.quote.midUsdCents > built.quote.usdOutCents);
    assert.equal(built.quote.netZarCents, 192_100);
  });

  it("rejects amounts outside R100 to R5 000", () => {
    assert.equal(buildQuote(9_999, "wallet", NOW, "q").ok, false);
    assert.equal(buildQuote(500_001, "wallet", NOW, "q").ok, false);
    assert.equal(buildQuote(100.5, "wallet", NOW, "q").ok, false);
  });
});

describe("placeOrder", () => {
  it("charges the card once and releases a wallet voucher", () => {
    const start = quoted(200_000, "wallet");
    const first = pay(start, "q1", "key-1", "card");
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.ledger.balanceZarCents, start.balanceZarCents - 200_000);
    assert.equal(first.order.status, "in_wallet");
    assert.equal(first.order.voucherAt, NOW);
    assert.equal(first.order.usdOutCents, 10_761);
    assert.equal(first.ledger.quotes[0]?.consumedBy, first.order.ref);
  });

  it("returns the same order when the signal retries the same key", () => {
    const start = quoted(200_000, "wallet");
    const first = pay(start, "q1", "key-1", "card");
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const retry = placeOrder(
      first.ledger,
      { quoteId: "q1", pin: "0000", idempotencyKey: "key-1", payWith: "card" },
      NOW + 1000,
      refs(),
    );
    assert.equal(retry.ok, true);
    if (!retry.ok) return;
    assert.equal(retry.order.ref, first.order.ref);
    assert.equal(retry.ledger.balanceZarCents, first.ledger.balanceZarCents);
    assert.equal(retry.ledger.pinMisses, 0);
  });

  it("does not charge a wrong PIN or reuse a spent quote", () => {
    const start = quoted(200_000, "wallet");
    const wrong = pay(start, "q1", "key-1", "card", "1111");
    assert.equal(wrong.ok, false);
    if (wrong.ok) return;
    assert.equal(wrong.error, "bad_pin");
    assert.equal(wrong.ledger.balanceZarCents, start.balanceZarCents);
    assert.equal(wrong.ledger.pinMisses, 1);
    assert.equal(wrong.ledger.quotes[0]?.consumedBy, null);

    const first = pay(wrong.ledger, "q1", "key-2", "card");
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const second = pay(first.ledger, "q1", "key-3", "card");
    assert.equal(second.ok, false);
    if (second.ok) return;
    assert.equal(second.error, "quote_used");
    assert.equal(second.ledger.balanceZarCents, first.ledger.balanceZarCents);
  });

  it("refuses an expired lock and an empty card", () => {
    const start = quoted(200_000, "wallet");
    const expired = pay(start, "q1", "key-1", "card", "2580", NOW + 16 * 60 * 1000);
    assert.equal(expired.ok, false);
    if (expired.ok) return;
    assert.equal(expired.error, "quote_expired");
    assert.equal(expired.ledger.balanceZarCents, start.balanceZarCents);

    const poor = { ...start, balanceZarCents: 50_000 };
    const broke = pay(poor, "q1", "key-2", "card");
    assert.equal(broke.ok, false);
    if (broke.ok) return;
    assert.equal(broke.error, "insufficient");
    assert.equal(broke.ledger.balanceZarCents, 50_000);
  });

  it("holds the voucher until retail cash is confirmed", () => {
    const start = quoted(150_000, "cash", "cash-q");
    const placed = pay(start, "cash-q", "key-retail", "retail");
    assert.equal(placed.ok, true);
    if (!placed.ok) return;
    assert.equal(placed.order.status, "awaiting_payment");
    assert.equal(placed.order.voucherAt, null);
    assert.equal(placed.ledger.balanceZarCents, start.balanceZarCents);

    const tooSoon = markCollected(placed.ledger, placed.order.ref, NOW);
    assert.equal(tooSoon.ok, false);

    const paid = markPaid(placed.ledger, placed.order.ref, NOW + 1000);
    assert.equal(paid.ok, true);
    if (!paid.ok) return;
    assert.equal(paid.order.status, "ready");
    assert.ok(paid.order.voucherAt);

    const again = markPaid(paid.ledger, placed.order.ref, NOW + 2000);
    assert.equal(again.ok, true);
    if (!again.ok) return;
    assert.equal(again.order.voucherAt, paid.order.voucherAt);

    const collected = markCollected(again.ledger, placed.order.ref, NOW + 3000);
    assert.equal(collected.ok, true);
    if (!collected.ok) return;
    assert.equal(collected.order.status, "collected");
  });
});

describe("history", () => {
  it("opens payday with September already cashed out and the card intact", () => {
    const ledger = freshLedger();
    assert.equal(ledger.balanceZarCents, 428_040);
    assert.equal(ledger.orders[0]?.ref, "MUK-7H2K9");
    assert.equal(ledger.orders[0]?.status, "cashed_out");
    assert.equal(ledger.orders[0]?.usdOutCents, 10_761);
  });
});
