import { randomUUID } from "crypto";
import { withDb } from "./db";
import { getSession, setLanguage, type Account } from "./auth";
import { normalizePhone, verifySecret } from "./passwords";
import {
  confirmTransfer,
  createTransferQuote,
  listTransfers,
  reissueLatestTransferCollectionCode,
} from "./transfers";
import { demoConfig } from "./config.ts";

type Step = "phone" | "secret" | "menu" | "recipient" | "amount" | "review" | "note";
type Payload = {
  buffer?: string;
  note?: string;
  recipientId?: string;
  recipientName?: string;
  quoteId?: string;
  quoteSummary?: string;
};
type UssdRow = { user_id: string | null; step: Step; payload: Payload };

function formatMoney(amountMinor: number, currency: string, lang: "en" | "sn") {
  return new Intl.NumberFormat(lang === "sn" ? "sn-ZW" : "en-ZW", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

function screenFor(account: Account | null, row: UssdRow) {
  const lang = account?.preferredLanguage ?? account?.lang ?? "en";
  const brand = `${demoConfig.appName} ${demoConfig.ussdDemoCode}`;
  if (row.step === "phone" || !account) {
    return `${brand}\nPhone number\n${row.payload.buffer ?? ""}\n${row.payload.note ?? ""}\n\nType, then OK`;
  }
  if (row.step === "secret") {
    return `${brand}\nPassword\n${"•".repeat((row.payload.buffer ?? "").length)}\n${row.payload.note ?? ""}\n\nOK to sign in`;
  }
  if (row.step === "note") return `${row.payload.note ?? ""}\n\n0 Menu`;
  if (row.step === "recipient") {
    return `Recipient phone\n${row.payload.buffer ?? ""}\n${row.payload.note ?? ""}\n\nType, then OK\n0 Back`;
  }
  if (row.step === "amount") {
    return `Amount to send\nR${row.payload.buffer ?? "0"}\n\nType whole rands, then OK\n0 Back`;
  }
  if (row.step === "review") return `${row.payload.quoteSummary ?? "Quote unavailable"}\n\n1 Confirm and send\n0 Cancel`;
  if (account.role === "receiver") {
    return `${brand}\n\n1 Check transfer status\n2 Request a new SMS code\n3 ${lang === "en" ? "ChiShona" : "English"}`;
  }
  return `${brand}\n\n1 Send to registered recipient\n2 Check recent transfers\n3 ${lang === "en" ? "ChiShona" : "English"}`;
}

async function loadAccount(id: string): Promise<Account | null> {
  return withDb(async (client) => {
    const result = await client.query(
      `select id, role, name, phone_number as phone, city, country,
              coalesce(preferred_language, lang) as preferred_language
       from users where id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) return null;
    const preferredLanguage = row.preferred_language === "sn" ? "sn" : "en";
    return {
      id: String(row.id),
      role: row.role,
      name: String(row.name),
      phone: String(row.phone),
      city: row.city == null ? null : String(row.city),
      country: row.country == null ? null : String(row.country),
      lang: preferredLanguage,
      preferredLanguage,
    };
  });
}

async function save(id: string, row: UssdRow) {
  await withDb(async (client) => {
    await client.query("delete from ussd_sessions where id = $1", [id]);
    await client.query(
      "insert into ussd_sessions (id, user_id, step, payload, updated_at) values ($1,$2,$3,$4::jsonb,$5)",
      [id, row.user_id, row.step, JSON.stringify(row.payload), Date.now()],
    );
  });
}

export async function ussdPress(sessionId: string, key: string): Promise<string> {
  const cookie = await getSession();
  const existing = await withDb(async (client) => {
    const result = await client.query("select user_id, step, payload from ussd_sessions where id = $1", [sessionId]);
    return result.rows[0] as UssdRow | undefined;
  });
  let row: UssdRow = existing ?? { user_id: cookie?.id ?? null, step: cookie ? "menu" : "phone", payload: {} };
  if (cookie && !row.user_id) row = { user_id: cookie.id, step: "menu", payload: {} };
  if (key !== "") row = await applyKey(row, key);
  await save(sessionId, row);
  const account = row.user_id ? await loadAccount(row.user_id) : null;
  return screenFor(account, row);
}

async function applyKey(row: UssdRow, key: string): Promise<UssdRow> {
  if (row.step === "phone") return phoneStep(row, key);
  if (row.step === "secret") return secretStep(row, key);
  const account = row.user_id ? await loadAccount(row.user_id) : null;
  if (!account) return { user_id: null, step: "phone", payload: {} };
  if (row.step === "note") {
    return key === "0" || key === "ok" ? { user_id: account.id, step: "menu", payload: {} } : row;
  }
  if (row.step === "menu") return menuStep(account, key);
  if (account.role === "sender") return senderStep(account, row, key);
  return row;
}

async function phoneStep(row: UssdRow, key: string): Promise<UssdRow> {
  const buffer = row.payload.buffer ?? "";
  if (key === "del") return { ...row, payload: { buffer: buffer.slice(0, -1) } };
  if (key === "ok") {
    const matches = await withDb(async (client) => {
      const result = await client.query("select id, phone_number, country from users");
      return result.rows.filter((candidate) =>
        normalizePhone(buffer, candidate.country == null ? undefined : String(candidate.country)) === String(candidate.phone_number),
      );
    });
    if (matches.length !== 1) return { ...row, payload: { note: matches.length ? "Enter the country calling code too." : "This number is not registered." } };
    return { user_id: String(matches[0].id), step: "secret", payload: { buffer: "" } };
  }
  if (/^\d$/.test(key) && buffer.length < 15) return { ...row, payload: { buffer: buffer + key } };
  return row;
}

async function secretStep(row: UssdRow, key: string): Promise<UssdRow> {
  const buffer = row.payload.buffer ?? "";
  if (key === "del") return { ...row, payload: { buffer: buffer.slice(0, -1) } };
  if (key === "ok") {
    const valid = await withDb(async (client) => {
      const result = await client.query("select password_hash from users where id = $1", [row.user_id]);
      return result.rows[0] ? verifySecret(buffer, String(result.rows[0].password_hash)) : false;
    });
    if (!valid) return { ...row, payload: { note: "Sign-in failed. Try again." } };
    return { ...row, step: "menu", payload: {} };
  }
  if (/^\d$/.test(key) && buffer.length < 64) return { ...row, payload: { buffer: buffer + key } };
  return row;
}

async function menuStep(account: Account, key: string): Promise<UssdRow> {
  if (key === "3") {
    await setLanguage(account.id, account.lang === "en" ? "sn" : "en");
    return { user_id: account.id, step: "menu", payload: {} };
  }
  if (account.role === "receiver") {
    if (key === "1") {
      const latest = (await listTransfers(account.id, "receiver"))[0];
      const lang = account.preferredLanguage;
      const note = latest
        ? `${latest.id}\n${formatMoney(latest.destinationAmountMinor, latest.destinationCurrency, lang)}\n${latest.status}`
        : "No transfer found.";
      return { user_id: account.id, step: "note", payload: { note } };
    }
    if (key === "2") {
      try {
        const status = await reissueLatestTransferCollectionCode(account.id);
        const note = status === "SMS_SENT"
          ? "New code sent to your registered phone."
          : status === "SMS_FAILED"
            ? "SMS delivery failed. Contact the sender."
            : "SMS requested. Delivery is not confirmed.";
        return { user_id: account.id, step: "note", payload: { note } };
      } catch {
        return { user_id: account.id, step: "note", payload: { note: "No eligible transfer found." } };
      }
    }
    return { user_id: account.id, step: "menu", payload: {} };
  }
  if (key === "1") return { user_id: account.id, step: "recipient", payload: {} };
  if (key === "2") {
    const latest = (await listTransfers(account.id, "sender"))[0];
    const note = latest ? `${latest.id}\n${latest.status}` : "No transfers found.";
    return { user_id: account.id, step: "note", payload: { note } };
  }
  return { user_id: account.id, step: "menu", payload: {} };
}

async function senderStep(account: Account, row: UssdRow, key: string): Promise<UssdRow> {
  if (row.step === "recipient") {
    const buffer = row.payload.buffer ?? "";
    if (key === "del") return { ...row, payload: { ...row.payload, buffer: buffer.slice(0, -1) } };
    if (key !== "ok") {
      if (/^\d$/.test(key) && buffer.length < 15) return { ...row, payload: { buffer: buffer + key } };
      if (key === "0" && buffer === "") return { user_id: account.id, step: "menu", payload: {} };
      return row;
    }
    const recipients = await withDb(async (client) => {
      const result = await client.query(
        "select id, name, phone_number, country from users where role = 'receiver'",
      );
      return result.rows.filter((candidate) =>
        normalizePhone(buffer, candidate.country == null ? undefined : String(candidate.country)) === String(candidate.phone_number),
      );
    });
    if (recipients.length !== 1) return { ...row, payload: { note: recipients.length ? "Enter the country calling code too." : "No registered recipient matches this number." } };
    const recipient = recipients[0];
    return {
      user_id: account.id,
      step: "amount",
      payload: { recipientId: String(recipient.id), recipientName: String(recipient.name), buffer: "" },
    };
  }
  if (row.step === "amount") {
    const buffer = row.payload.buffer ?? "";
    if (key === "del") return { ...row, payload: { ...row.payload, buffer: buffer.slice(0, -1) } };
    if (key !== "ok") {
      if (/^\d$/.test(key) && buffer.length < 10) return { ...row, payload: { ...row.payload, buffer: buffer + key } };
      if (key === "0" && buffer === "") return { user_id: account.id, step: "menu", payload: {} };
      return row;
    }
    const amountMinor = Number(buffer) * 100;
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !row.payload.recipientId) {
      return { ...row, payload: { ...row.payload, note: "Enter a positive amount in whole rands." } };
    }
    try {
      const quote = await createTransferQuote(account.id, row.payload.recipientId, amountMinor);
      const lang = account.preferredLanguage;
      const summary = `${quote.recipient.name}\nYou send ${formatMoney(quote.amountMinor, quote.sourceCurrency, lang)}\nThey receive ${formatMoney(quote.destinationAmountMinor, quote.destinationCurrency, lang)}\nRate ${quote.exchangeRate}\nFee ${formatMoney(quote.feeMinor, quote.sourceCurrency, lang)}\nCollection ${quote.collectionLocation}`;
      return { user_id: account.id, step: "review", payload: { quoteId: quote.id, quoteSummary: summary } };
    } catch {
      return { user_id: account.id, step: "note", payload: { note: "Quote unavailable. Try again later." } };
    }
  }
  if (row.step === "review") {
    if (key === "0") return { user_id: account.id, step: "menu", payload: {} };
    if (key !== "1" || !row.payload.quoteId) return row;
    try {
      const result = await confirmTransfer(account.id, row.payload.quoteId, randomUUID(), true);
      const lang = account.preferredLanguage;
      return {
        user_id: account.id,
        step: "note",
        payload: {
          note: `${result.transfer.id}\n${result.transfer.status}\n${formatMoney(result.transfer.destinationAmountMinor, result.transfer.destinationCurrency, lang)}\n${result.smsStatus ?? "SMS_REQUESTED"}`,
        },
      };
    } catch {
      return { user_id: account.id, step: "note", payload: { note: "Transfer could not be sent. Nothing was confirmed." } };
    }
  }
  return row;
}
