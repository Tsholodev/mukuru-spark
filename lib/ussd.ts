import { randomBytes } from "crypto";
import { addQuote, buildQuote, markCollected, placeOrder, projectOrder, type PayWith, type Payout } from "./engine";
import { t, type Lang } from "./copy";
import { withDb } from "./db";
import { usd, zar } from "./format";
import { readLedger, updateLedger } from "./store";
import { getSession, setLanguage, type Account } from "./auth";
import { normalizePhone, verifySecret } from "./passwords";

type Step = "phone" | "secret" | "menu" | "amount" | "custom" | "payout" | "review" | "cardpin" | "note";

type Payload = {
  phone?: string;
  amount?: number;
  payout?: Payout;
  payWith?: PayWith;
  quoteId?: string;
  buffer?: string;
  note?: string;
};

type UssdRow = { user_id: string | null; step: Step; payload: Payload };

function screenFor(account: Account | null, step: Step, payload: Payload, balance: number, latest: string) {
  const lang: Lang = account?.lang ?? "en";
  if (step === "phone" || !account) {
    return `Mukuru *120#\nPhone number\n${payload.buffer || ""}\n${payload.note || ""}\n\nType, then OK`;
  }
  if (step === "secret") {
    return `Mukuru *120#\n${account.role === "sender" ? "Password" : "PIN"}\n${"•".repeat((payload.buffer || "").length)}\n${payload.note || ""}\n\nOK to open\n0 Back`;
  }
  if (step === "note") return `${payload.note || ""}\n\n0 Menu`;
  if (step === "amount") return `Send home\n\n1 Same as Sep  R2000\n2 Other amount\n0 Menu`;
  if (step === "custom") return `Amount in rands\nR${payload.buffer || "0"}\n\nOK to continue\n0 Back`;
  if (step === "payout") return `R${payload.amount ? payload.amount / 100 : 0}\n\n1 Her wallet\n2 Cash at booth\n0 Back`;
  if (step === "review") return payload.note || "Quote missing\n\n0 Menu";
  if (step === "cardpin") return `Card PIN\n${"•".repeat((payload.buffer || "").length)}\nNot your sign-in password\n\nOK to send\n0 Menu`;
  if (account.role === "receiver") {
    return `Mukuru *120#\n${t(lang, "ussdLive")}\n\n1 Is my money ready?\n2 Collect\n3 ${lang === "en" ? "ChiShona" : "English"}\n4 Help`;
  }
  return `Mukuru *120#\n${t(lang, "ussdLive")}\nCard ${zar(balance)}\n\n1 Send home\n2 Balance\n3 Track money\n4 ${lang === "en" ? "ChiShona" : "English"}\n5 Help${latest ? `\n\nLatest ${latest}` : ""}`;
}

async function loadAccount(id: string): Promise<Account | null> {
  return withDb(async (client) => {
    const found = await client.query(
      "select id, role, name, phone, city, lang from users where id = $1",
      [id],
    );
    return found.rows[0] ?? null;
  });
}

async function save(id: string, row: UssdRow) {
  await withDb((client) =>
    client.query(
      `insert into ussd_sessions (id, user_id, step, payload, updated_at)
       values ($1, $2, $3, $4::jsonb, $5)
       on conflict (id) do update set user_id = $2, step = $3, payload = $4::jsonb, updated_at = $5`,
      [id, row.user_id, row.step, JSON.stringify(row.payload), Date.now()],
    ),
  );
}

export async function ussdPress(sessionId: string, key: string): Promise<string> {
  const cookie = await getSession();
  const existing = await withDb(async (client) => {
    const found = await client.query("select user_id, step, payload from ussd_sessions where id = $1", [sessionId]);
    return found.rows[0] as UssdRow | undefined;
  });
  let row: UssdRow = existing ?? { user_id: cookie?.id ?? null, step: cookie ? "menu" : "phone", payload: {} };
  if (cookie && !row.user_id) {
    row = { user_id: cookie.id, step: "menu", payload: {} };
  }

  if (key !== "") row = await applyKey(row, key);
  await save(sessionId, row);

  const account = row.user_id ? await loadAccount(row.user_id) : null;
  const ledger = await readLedger();
  const latest = ledger.orders[0];
  const latestLabel = latest ? `${latest.ref} ${projectOrder(latest, Date.now()).status}` : "";
  return screenFor(account, row.step, row.payload, ledger.balanceZarCents, latestLabel);
}

async function applyKey(row: UssdRow, key: string): Promise<UssdRow> {
  if (row.step === "phone") return phoneStep(row, key);
  if (row.step === "secret") return secretStep(row, key);
  const account = row.user_id ? await loadAccount(row.user_id) : null;
  if (!account) return { user_id: null, step: "phone", payload: {} };
  if (row.step === "note") return key === "0" || key === "ok" ? { ...row, step: "menu", payload: {} } : row;
  if (row.step === "menu") return menuStep(account, row, key);
  if (account.role === "sender") return senderStep(account, row, key);
  return row;
}

async function phoneStep(row: UssdRow, key: string): Promise<UssdRow> {
  const buffer = row.payload.buffer || "";
  if (key === "del") return { ...row, payload: { buffer: buffer.slice(0, -1) } };
  if (key === "ok") {
    const phone = normalizePhone(buffer);
    const found = await withDb(async (client) => {
      const result = await client.query("select id from users where phone = $1", [phone]);
      return result.rows[0]?.id as string | undefined;
    });
    if (!found) return { user_id: null, step: "phone", payload: { note: "That phone is not on this corridor." } };
    return { user_id: found, step: "secret", payload: { phone, buffer: "" } };
  }
  if (/^\d$/.test(key) && buffer.length < 15) return { ...row, payload: { buffer: buffer + key } };
  return row;
}

async function secretStep(row: UssdRow, key: string): Promise<UssdRow> {
  if (key === "0" && !(row.payload.buffer || "")) return { user_id: null, step: "phone", payload: {} };
  const buffer = row.payload.buffer || "";
  if (key === "del") return { ...row, payload: { ...row.payload, buffer: buffer.slice(0, -1) } };
  if (key === "ok") {
    const ok = await withDb(async (client) => {
      const found = await client.query("select password_hash from users where id = $1", [row.user_id]);
      return found.rows[0] ? verifySecret(buffer, found.rows[0].password_hash) : false;
    });
    if (!ok) return { ...row, step: "secret", payload: { ...row.payload, buffer: "", note: "Wrong sign-in." } };
    return { user_id: row.user_id, step: "menu", payload: {} };
  }
  if (/^\d$/.test(key) && buffer.length < 12) return { ...row, payload: { ...row.payload, buffer: buffer + key } };
  return row;
}

async function menuStep(account: Account, row: UssdRow, key: string): Promise<UssdRow> {
  if (account.role === "receiver") {
    if (key === "1") return { ...row, step: "note", payload: { note: await receiverStatus() } };
    if (key === "2") return { ...row, step: "note", payload: { note: await receiverCollect() } };
    if (key === "3") {
      await setLanguage(account.id, account.lang === "en" ? "sn" : "en");
      return row;
    }
    if (key === "4") {
      return { ...row, step: "note", payload: { note: "Voucher + ID to collect.\nMukuru will not ask for a PIN by phone." } };
    }
    return row;
  }
  if (key === "1") return { ...row, step: "amount", payload: {} };
  if (key === "2") {
    const ledger = await readLedger();
    return { ...row, step: "note", payload: { note: `Card balance\n${zar(ledger.balanceZarCents)}` } };
  }
  if (key === "3") return { ...row, step: "note", payload: { note: await trackText() } };
  if (key === "4") {
    await setLanguage(account.id, account.lang === "en" ? "sn" : "en");
    return row;
  }
  if (key === "5") {
    return { ...row, step: "note", payload: { note: "Fee is inside the amount.\nAmai is told when it is ready to collect." } };
  }
  return row;
}

async function senderStep(account: Account, row: UssdRow, key: string): Promise<UssdRow> {
  if (row.step === "amount") {
    if (key === "1") return reviewFor(200_000, "wallet");
    if (key === "2") return { ...row, step: "custom", payload: { buffer: "" } };
    if (key === "0") return { user_id: account.id, step: "menu", payload: {} };
  }
  if (row.step === "custom") {
    const buffer = row.payload.buffer || "";
    if (key === "0" && buffer === "") return { ...row, step: "amount", payload: {} };
    if (key === "del") return { ...row, payload: { buffer: buffer.slice(0, -1) } };
    if (key === "ok") {
      const amount = Number(buffer) * 100;
      if (!buffer || !Number.isInteger(amount)) return row;
      return { ...row, step: "payout", payload: { amount } };
    }
    if (/^\d$/.test(key) && buffer.length < 5) return { ...row, payload: { buffer: buffer + key } };
  }
  if (row.step === "payout") {
    if (key === "1" && row.payload.amount) return reviewFor(row.payload.amount, "wallet");
    if (key === "2" && row.payload.amount) return reviewFor(row.payload.amount, "cash");
    if (key === "0") return { ...row, step: "amount", payload: {} };
  }
  if (row.step === "review") {
    if (key === "1") return { ...row, step: "cardpin", payload: { ...row.payload, payWith: "card", buffer: "" } };
    if (key === "2") return { ...row, step: "cardpin", payload: { ...row.payload, payWith: "retail", buffer: "" } };
    if (key === "0") return { user_id: account.id, step: "menu", payload: {} };
  }
  if (row.step === "cardpin") return cardPin(account, row, key);
  return row;
}

async function reviewFor(amount: number, payout: Payout): Promise<UssdRow> {
  const built = buildQuote(amount, payout, Date.now(), crypto.randomUUID());
  if (!built.ok) return { user_id: "thandi", step: "note", payload: { note: "Amount must be from R100 to R5 000." } };
  await updateLedger((ledger) => ({ ledger: addQuote(ledger, built.quote), result: built.quote }));
  const quote = built.quote;
  return {
    user_id: "thandi",
    step: "review",
    payload: {
      quoteId: quote.id,
      amount,
      payout,
      note: `Amai gets ${usd(quote.usdOutCents)}\nYou pay ${zar(quote.amountZarCents)}\nFee ${zar(quote.feeZarCents)}\nRate locked\n\n1 Pay from card\n2 Pay at PEP\n0 Menu`,
    },
  };
}

async function cardPin(account: Account, row: UssdRow, key: string): Promise<UssdRow> {
  const buffer = row.payload.buffer || "";
  if (key === "0" && buffer === "") return { user_id: account.id, step: "menu", payload: {} };
  if (key === "del") return { ...row, payload: { ...row.payload, buffer: buffer.slice(0, -1) } };
  if (key === "ok") {
    if (buffer.length !== 4 || !row.payload.quoteId || !row.payload.payWith) return row;
    const placed = await updateLedger((ledger) => {
      const result = placeOrder(
        ledger,
        { quoteId: row.payload.quoteId as string, pin: buffer, idempotencyKey: `ussd-${row.payload.quoteId}`, payWith: row.payload.payWith as PayWith },
        Date.now(),
        newRef,
      );
      return { ledger: result.ledger, result };
    });
    if (!placed.ok) {
      return { user_id: account.id, step: "note", payload: { note: placed.error === "bad_pin" ? "Wrong card PIN. Nothing was charged." : "Not sent. Nothing was charged." } };
    }
    const visible = projectOrder(placed.order, Date.now());
    return {
      user_id: account.id,
      step: "note",
      payload: { note: `${visible.ref}\n${usd(visible.usdOutCents)}\n${visible.status}\nAmai is told when it is ready.` },
    };
  }
  if (/^\d$/.test(key) && buffer.length < 4) return { ...row, payload: { ...row.payload, buffer: buffer + key } };
  return row;
}

function newRef() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(5);
  let ref = "MUK-";
  for (let i = 0; i < 5; i++) ref += alphabet[bytes[i] % alphabet.length];
  return ref;
}

async function trackText() {
  const ledger = await readLedger();
  const order = ledger.orders.find((item) => !item.idempotencyKey.startsWith("seed-")) ?? ledger.orders[0];
  if (!order) return "No send yet.";
  const visible = projectOrder(order, Date.now());
  return `${visible.ref}\n${usd(visible.usdOutCents)}\n${visible.status.replaceAll("_", " ")}\n${zar(visible.amountZarCents)}`;
}

async function receiverStatus() {
  const ledger = await readLedger();
  const order = ledger.orders.find((item) => !item.idempotencyKey.startsWith("seed-"));
  if (!order) return "Nothing new for October.";
  const visible = projectOrder(order, Date.now());
  if (visible.status === "ready") return `Your money is ready to collect.\n${usd(visible.usdOutCents)}\n${visible.ref}`;
  if (visible.status === "collected") return `Collected.\n${visible.ref}`;
  if (!visible.paidAt) return "Mukuru has not been paid.";
  return `On the way.\n${usd(visible.usdOutCents)}\nNot ready to collect yet.`;
}

async function receiverCollect() {
  const ledger = await readLedger();
  const order = ledger.orders.find((item) => !item.idempotencyKey.startsWith("seed-"));
  if (!order) return "Nothing to collect.";
  const result = await updateLedger((current) => {
    const collected = markCollected(current, order.ref, Date.now());
    return { ledger: collected.ledger, result: collected };
  });
  if (!result.ok) return "Not ready to collect yet.";
  return `Collected.\n${result.order.ref}`;
}
