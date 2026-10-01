export const RATE_MILLI = 17850;
export const MID_MILLI = 17420;
export const QUOTE_TTL_MS = 15 * 60 * 1000;
export const DEMO_PIN = "2580";
export const MIN_CENTS = 10_000;
export const MAX_CENTS = 500_000;
export const OPENING_BALANCE_CENTS = 428_040;

export type Payout = "wallet" | "cash";
export type PayWith = "card" | "retail";
export type OrderStatus =
  | "awaiting_payment"
  | "in_wallet"
  | "ready"
  | "collected"
  | "cashed_out";

export type Quote = {
  id: string;
  amountZarCents: number;
  feeZarCents: number;
  netZarCents: number;
  usdOutCents: number;
  midUsdCents: number;
  rateMilli: number;
  midMilli: number;
  payout: Payout;
  createdAt: number;
  lockedUntil: number;
  consumedBy: string | null;
};

export type Order = {
  ref: string;
  idempotencyKey: string;
  quoteId: string;
  amountZarCents: number;
  feeZarCents: number;
  netZarCents: number;
  usdOutCents: number;
  rateMilli: number;
  payout: Payout;
  payWith: PayWith;
  status: OrderStatus;
  createdAt: number;
  paidAt: number | null;
  voucherAt: number | null;
  collectedAt: number | null;
  recipientName: string;
};

export type Ledger = {
  balanceZarCents: number;
  quotes: Quote[];
  orders: Order[];
  pinMisses: number;
};

export type ErrorCode =
  | "bad_amount"
  | "bad_pin"
  | "no_quote"
  | "quote_expired"
  | "quote_used"
  | "insufficient"
  | "bad_state"
  | "not_found"
  | "bad_request";

export function feeZarCents(amountZarCents: number, payout: Payout): number {
  const zar = amountZarCents / 100;
  let fee: number;
  if (zar <= 500) fee = 29;
  else if (zar <= 1000) fee = 49;
  else if (zar <= 2000) fee = 79;
  else if (zar <= 3500) fee = 99;
  else if (zar <= 5000) fee = 139;
  else fee = 179;
  if (payout === "cash") fee += 15;
  return fee * 100;
}

export function usdCentsFromNet(netZarCents: number, rateMilli: number): number {
  if (netZarCents <= 0 || rateMilli <= 0) return 0;
  return Math.floor((netZarCents * 1000) / rateMilli);
}

export function validateAmount(amountZarCents: number): ErrorCode | null {
  if (!Number.isInteger(amountZarCents)) return "bad_amount";
  if (amountZarCents < MIN_CENTS || amountZarCents > MAX_CENTS) return "bad_amount";
  return null;
}

export function buildQuote(
  amountZarCents: number,
  payout: Payout,
  now: number,
  id: string,
): { ok: true; quote: Quote } | { ok: false; error: ErrorCode } {
  if (validateAmount(amountZarCents)) return { ok: false, error: "bad_amount" };
  if (payout !== "wallet" && payout !== "cash") return { ok: false, error: "bad_request" };
  const fee = feeZarCents(amountZarCents, payout);
  const netZarCents = amountZarCents - fee;
  if (netZarCents <= 0) return { ok: false, error: "bad_amount" };
  return {
    ok: true,
    quote: {
      id,
      amountZarCents,
      feeZarCents: fee,
      netZarCents,
      usdOutCents: usdCentsFromNet(netZarCents, RATE_MILLI),
      midUsdCents: usdCentsFromNet(netZarCents, MID_MILLI),
      rateMilli: RATE_MILLI,
      midMilli: MID_MILLI,
      payout,
      createdAt: now,
      lockedUntil: now + QUOTE_TTL_MS,
      consumedBy: null,
    },
  };
}

export function addQuote(ledger: Ledger, quote: Quote): Ledger {
  return { ...ledger, quotes: [...ledger.quotes, quote] };
}

export function openQuote(ledger: Ledger, now: number): Quote | null {
  for (let i = ledger.quotes.length - 1; i >= 0; i--) {
    const quote = ledger.quotes[i];
    if (!quote.consumedBy && quote.lockedUntil >= now) return quote;
  }
  return null;
}

function paidStatus(payout: Payout): OrderStatus {
  return payout === "wallet" ? "in_wallet" : "ready";
}

export function placeOrder(
  ledger: Ledger,
  input: { quoteId: string; pin: string; idempotencyKey: string; payWith: PayWith },
  now: number,
  makeRef: () => string,
): { ledger: Ledger; ok: true; order: Order } | { ledger: Ledger; ok: false; error: ErrorCode } {
  if (!input.idempotencyKey || input.idempotencyKey.length > 80) {
    return { ledger, ok: false, error: "bad_request" };
  }
  if (input.payWith !== "card" && input.payWith !== "retail") {
    return { ledger, ok: false, error: "bad_request" };
  }

  const existing = ledger.orders.find((order) => order.idempotencyKey === input.idempotencyKey);
  if (existing) return { ledger, ok: true, order: existing };

  const quote = ledger.quotes.find((item) => item.id === input.quoteId);
  if (!quote) return { ledger, ok: false, error: "no_quote" };
  if (quote.consumedBy) return { ledger, ok: false, error: "quote_used" };
  if (now > quote.lockedUntil) return { ledger, ok: false, error: "quote_expired" };

  if (input.pin !== DEMO_PIN) {
    return {
      ledger: { ...ledger, pinMisses: ledger.pinMisses + 1 },
      ok: false,
      error: "bad_pin",
    };
  }

  if (input.payWith === "card" && ledger.balanceZarCents < quote.amountZarCents) {
    return { ledger, ok: false, error: "insufficient" };
  }

  let ref = makeRef();
  for (let attempt = 0; attempt < 5 && ledger.orders.some((order) => order.ref === ref); attempt++) {
    ref = makeRef();
  }

  const paid = input.payWith === "card";
  const order: Order = {
    ref,
    idempotencyKey: input.idempotencyKey,
    quoteId: quote.id,
    amountZarCents: quote.amountZarCents,
    feeZarCents: quote.feeZarCents,
    netZarCents: quote.netZarCents,
    usdOutCents: quote.usdOutCents,
    rateMilli: quote.rateMilli,
    payout: quote.payout,
    payWith: input.payWith,
    status: paid ? paidStatus(quote.payout) : "awaiting_payment",
    createdAt: now,
    paidAt: paid ? now : null,
    voucherAt: paid ? now : null,
    collectedAt: null,
    recipientName: "Rudo Ncube",
  };

  return {
    ok: true,
    order,
    ledger: {
      ...ledger,
      balanceZarCents: paid ? ledger.balanceZarCents - quote.amountZarCents : ledger.balanceZarCents,
      pinMisses: 0,
      quotes: ledger.quotes.map((item) =>
        item.id === quote.id ? { ...item, consumedBy: order.ref } : item,
      ),
      orders: [order, ...ledger.orders],
    },
  };
}

export function markPaid(
  ledger: Ledger,
  ref: string,
  now: number,
): { ledger: Ledger; ok: true; order: Order } | { ledger: Ledger; ok: false; error: ErrorCode } {
  const order = ledger.orders.find((item) => item.ref === ref);
  if (!order) return { ledger, ok: false, error: "not_found" };
  if (order.status !== "awaiting_payment") return { ledger, ok: true, order };
  const next: Order = {
    ...order,
    status: paidStatus(order.payout),
    paidAt: now,
    voucherAt: now,
  };
  return { ledger: replaceOrder(ledger, next), ok: true, order: next };
}

export function markCollected(
  ledger: Ledger,
  ref: string,
  now: number,
): { ledger: Ledger; ok: true; order: Order } | { ledger: Ledger; ok: false; error: ErrorCode } {
  const order = ledger.orders.find((item) => item.ref === ref);
  if (!order) return { ledger, ok: false, error: "not_found" };
  if (order.status === "collected" || order.status === "cashed_out") {
    return { ledger, ok: true, order };
  }
  if (order.status !== "ready" && order.status !== "in_wallet") {
    return { ledger, ok: false, error: "bad_state" };
  }
  const next: Order = {
    ...order,
    status: order.status === "in_wallet" ? "cashed_out" : "collected",
    collectedAt: now,
  };
  return { ledger: replaceOrder(ledger, next), ok: true, order: next };
}

function replaceOrder(ledger: Ledger, order: Order): Ledger {
  return {
    ...ledger,
    orders: ledger.orders.map((item) => (item.ref === order.ref ? order : item)),
  };
}

function seedOrder(partial: {
  ref: string;
  createdAt: number;
  amountZarCents: number;
  payout: Payout;
  status: "collected" | "cashed_out";
}): Order {
  const fee = feeZarCents(partial.amountZarCents, partial.payout);
  const net = partial.amountZarCents - fee;
  return {
    ref: partial.ref,
    idempotencyKey: `seed-${partial.ref}`,
    quoteId: `seed-${partial.ref}`,
    amountZarCents: partial.amountZarCents,
    feeZarCents: fee,
    netZarCents: net,
    usdOutCents: usdCentsFromNet(net, RATE_MILLI),
    rateMilli: RATE_MILLI,
    payout: partial.payout,
    payWith: "card",
    status: partial.status,
    createdAt: partial.createdAt,
    paidAt: partial.createdAt,
    voucherAt: partial.createdAt,
    collectedAt: partial.createdAt + 36 * 60 * 60 * 1000,
    recipientName: "Rudo Ncube",
  };
}

export function freshLedger(): Ledger {
  return {
    balanceZarCents: OPENING_BALANCE_CENTS,
    pinMisses: 0,
    quotes: [],
    orders: [
      seedOrder({
        ref: "MUK-7H2K9",
        createdAt: Date.UTC(2026, 8, 3, 7, 12, 0),
        amountZarCents: 200_000,
        payout: "wallet",
        status: "cashed_out",
      }),
      seedOrder({
        ref: "MUK-8QD4P",
        createdAt: Date.UTC(2026, 7, 4, 8, 5, 0),
        amountZarCents: 200_000,
        payout: "wallet",
        status: "cashed_out",
      }),
      seedOrder({
        ref: "MUK-3N6WT",
        createdAt: Date.UTC(2026, 6, 2, 9, 40, 0),
        amountZarCents: 150_000,
        payout: "cash",
        status: "collected",
      }),
    ],
  };
}

export function findOrder(ledger: Ledger, ref: string): Order | undefined {
  return ledger.orders.find((order) => order.ref === ref);
}
