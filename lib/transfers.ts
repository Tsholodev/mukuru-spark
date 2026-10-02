import { createHmac, randomInt, randomUUID, timingSafeEqual } from "crypto";
import { getPool, withDb } from "./db.ts";
import { getExchangeRate } from "./exchange-rates.ts";
import { calculateTransferAmounts } from "./transfer-calculation.ts";
import { createSmsService, type SmsStatus } from "./sms-service.ts";
import { maskPhone } from "./passwords.ts";
import { canTransitionTransfer, type TransferStatus } from "./transfer-status.ts";

const COLLECTION_CODE_TTL_MS = 24 * 60 * 60 * 1000;
export type { TransferStatus } from "./transfer-status.ts";

export function generateCollectionCode() {
  return String(randomInt(100_000, 1_000_000));
}

async function generateUniqueCollectionCode(client: import("pg").PoolClient) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateCollectionCode();
    const hash = secretHash(code);
    const existing = await client.query("select 1 from transfers where collection_code_hash = $1", [hash]);
    if (existing.rowCount === 0) return { code, hash };
  }
  throw new Error("collection_code_generation_failed");
}

export type TransferView = {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  recipientCountry: string | null;
  preferredLanguage: "en" | "sn";
  amountMinor: number;
  sourceCurrency: string;
  destinationAmountMinor: number;
  destinationCurrency: string;
  exchangeRate: number;
  feeMinor: number;
  collectionLocation: string;
  status: TransferStatus;
  createdAt: string;
  updatedAt: string;
  events: { status: TransferStatus; createdAt: string }[];
};

type QuoteRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  amount_minor: string | number;
  source_currency: string;
  destination_currency: string;
  destination_amount_minor: string | number;
  exchange_rate: string | number;
  fee_minor: string | number;
  collection_location: string;
  expires_at: string | number;
  consumed_by: string | null;
};

function configured(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing_configuration:${name}`);
  return value;
}

function secretHash(value: string) {
  return createHmac("sha256", configured("COLLECTION_CODE_SECRET")).update(value).digest("hex");
}

function validHash(value: string, stored: string) {
  const actual = Buffer.from(secretHash(value), "hex");
  const expected = Buffer.from(stored, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function formatTransfer(row: Record<string, unknown>, events: Record<string, unknown>[] = []): TransferView {
  return {
    id: String(row.id),
    senderId: String(row.sender_id),
    senderName: String(row.sender_name),
    recipientId: String(row.recipient_id),
    recipientName: String(row.recipient_name),
    recipientCountry: row.recipient_country == null ? null : String(row.recipient_country),
    preferredLanguage: row.preferred_language === "sn" ? "sn" : "en",
    amountMinor: Number(row.amount_minor),
    sourceCurrency: String(row.source_currency).trim(),
    destinationAmountMinor: Number(row.destination_amount_minor),
    destinationCurrency: String(row.destination_currency).trim(),
    exchangeRate: Number(row.exchange_rate),
    feeMinor: Number(row.fee_minor),
    collectionLocation: String(row.collection_location),
    status: row.status as TransferStatus,
    createdAt: new Date(Number(row.created_at)).toISOString(),
    updatedAt: new Date(Number(row.updated_at)).toISOString(),
    events: events.map((event) => ({
      status: event.status as TransferStatus,
      createdAt: new Date(Number(event.created_at)).toISOString(),
    })),
  };
}

const TRANSFER_SELECT = `
  select t.*, sender.name as sender_name, recipient.name as recipient_name,
         recipient.phone_number as recipient_phone_number, recipient.country as recipient_country,
         coalesce(recipient.preferred_language, recipient.lang) as preferred_language
  from transfers t
  join users sender on sender.id = t.sender_id
  join users recipient on recipient.id = t.recipient_id`;

export async function createTransferQuote(senderId: string, recipientId: string, amountMinor: number) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error("invalid_amount");
  const recipient = await withDb(async (client) => {
    const result = await client.query(
      `select id, name, phone_number, country, coalesce(preferred_language, lang) as preferred_language
       from users where id = $1 and role = 'receiver'`,
      [recipientId],
    );
    return result.rows[0];
  });
  if (!recipient) throw new Error("recipient_not_found");

  const sourceCurrency = configured("SOURCE_CURRENCY").toUpperCase();
  const destinationCurrency = configured("DESTINATION_CURRENCY").toUpperCase();
  const feeBasisPoints = Number(configured("TRANSFER_FEE_BPS"));
  const collectionLocation = configured("TRANSFER_COLLECTION_LOCATION");
  if (!/^[A-Z]{3}$/.test(sourceCurrency) || !/^[A-Z]{3}$/.test(destinationCurrency)) {
    throw new Error("invalid_currency_configuration");
  }
  const exchangeRate = await getExchangeRate(sourceCurrency, destinationCurrency);
  const values = calculateTransferAmounts(amountMinor, exchangeRate, feeBasisPoints);
  const expiresAt = Date.now() + Number(process.env.TRANSFER_QUOTE_TTL_SECONDS ?? "300") * 1000;
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) throw new Error("invalid_quote_ttl");
  const id = randomUUID();

  await withDb((client) =>
    client.query(
      `insert into transfer_quotes (
        id, sender_id, recipient_id, amount_minor, source_currency, destination_currency,
        destination_amount_minor, exchange_rate, fee_minor, collection_location, expires_at, created_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, senderId, recipientId, values.amountMinor, sourceCurrency, destinationCurrency,
        values.destinationAmountMinor, exchangeRate, values.feeMinor, collectionLocation, expiresAt, Date.now()],
    ),
  );

  return {
    id,
    recipient: {
      id: String(recipient.id),
      name: String(recipient.name),
      maskedPhoneNumber: maskPhone(String(recipient.phone_number)),
      country: recipient.country == null ? null : String(recipient.country),
      preferredLanguage: recipient.preferred_language === "sn" ? "sn" : "en",
    },
    amountMinor: values.amountMinor,
    sourceCurrency,
    destinationAmountMinor: values.destinationAmountMinor,
    destinationCurrency,
    exchangeRate,
    feeMinor: values.feeMinor,
    collectionLocation,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export async function confirmTransfer(senderId: string, quoteId: string, idempotencyKey: string, confirmed: boolean) {
  if (!confirmed) throw new Error("confirmation_required");
  if (!quoteId || quoteId.length > 80 || !idempotencyKey || idempotencyKey.length > 120) {
    throw new Error("invalid_request");
  }

  let transferId = "";
  let collectionCode = "";
  let created = false;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const existing = await client.query(
      `select id from transfers where sender_id = $1 and idempotency_key = $2 for update`,
      [senderId, idempotencyKey],
    );
    if (existing.rows[0]) {
      transferId = String(existing.rows[0].id);
      await client.query("commit");
    } else {
      const quoteResult = await client.query(
        `select * from transfer_quotes where id = $1 and sender_id = $2 for update`,
        [quoteId, senderId],
      );
      const quote = quoteResult.rows[0] as QuoteRow | undefined;
      if (!quote) throw new Error("quote_not_found");
      if (quote.consumed_by) throw new Error("quote_already_used");
      if (Number(quote.expires_at) <= Date.now()) throw new Error("quote_expired");

      const amountMinor = Number(quote.amount_minor);
      const sender = await client.query("select balance_cents from users where id = $1 for update", [senderId]);
      if (!sender.rows[0] || Number(sender.rows[0].balance_cents) < amountMinor) {
        throw new Error("insufficient_balance");
      }

      transferId = randomUUID();
      const generatedCode = await generateUniqueCollectionCode(client);
      collectionCode = generatedCode.code;
      const now = Date.now();
      const expiresAt = now + COLLECTION_CODE_TTL_MS;
      await client.query(
        `insert into transfers (
          id, idempotency_key, sender_id, recipient_id, amount_minor, source_currency,
          destination_currency, destination_amount_minor, exchange_rate, fee_minor,
          collection_location, collection_code_hash, collection_code_expires_at, status, created_at, updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'SENT',$14,$14)`,
        [transferId, idempotencyKey, senderId, quote.recipient_id, quote.amount_minor,
          quote.source_currency, quote.destination_currency, quote.destination_amount_minor,
          quote.exchange_rate, quote.fee_minor, quote.collection_location, generatedCode.hash, expiresAt, now],
      );
      await client.query(
        "insert into transfer_events (id, transfer_id, status, actor_id, created_at) values ($1,$2,'SENT',$3,$4)",
        [randomUUID(), transferId, senderId, now],
      );
      const debit = await client.query(
        "update users set balance_cents = balance_cents - $2 where id = $1 and balance_cents >= $2",
        [senderId, amountMinor],
      );
      if (debit.rowCount === 0) throw new Error("insufficient_balance");
      await client.query("update transfer_quotes set consumed_by = $2 where id = $1", [quoteId, transferId]);
      await client.query("commit");
      created = true;
    }
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  let smsStatus: SmsStatus | null = null;
  if (created) {
    try {
      smsStatus = await requestTransferSms(transferId, collectionCode);
    } catch {
      smsStatus = "SMS_REQUESTED";
    }
  } else {
    smsStatus = await getLatestSmsStatus(transferId);
  }
  const transfer = await getTransfer(transferId);
  if (!transfer) throw new Error("transfer_not_found");
  return { transfer, smsStatus, created };
}

async function requestTransferSms(transferId: string, collectionCode: string): Promise<SmsStatus> {
  const service = createSmsService();
  const requestEventId = randomUUID();
  const requestedAt = Date.now();
  await withDb((client) =>
    client.query(
      `insert into sms_delivery_events (id, transfer_id, status, provider, safe_response, created_at)
       values ($1,$2,'SMS_REQUESTED','pending',$3::jsonb,$4)`,
      [requestEventId, transferId, JSON.stringify({ bodyStored: false }), requestedAt],
    ),
  );

  const transfer = await withDb(async (client) => {
    const result = await client.query(`${TRANSFER_SELECT} where t.id = $1`, [transferId]);
    return result.rows[0];
  });
  if (!transfer) throw new Error("transfer_not_found");

  const delivery = await service.sendTransferNotification({
    transferId,
    senderName: String(transfer.sender_name),
    recipientPhoneNumber: String(transfer.recipient_phone_number),
    recipientPreferredLanguage: transfer.preferred_language === "sn" ? "sn" : "en",
    destinationAmountMinor: Number(transfer.destination_amount_minor),
    destinationCurrency: String(transfer.destination_currency).trim(),
    collectionCode,
    collectionLocation: String(transfer.collection_location),
    ussdCode: process.env.NEXT_PUBLIC_USSD_DEMO_CODE ?? "",
  });

  if (delivery.status !== "SMS_REQUESTED") {
    await withDb((client) =>
      client.query(
        `insert into sms_delivery_events (id, transfer_id, status, provider, provider_message_id, safe_response, created_at)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
        [randomUUID(), transferId, delivery.status, delivery.provider, delivery.providerMessageId,
          JSON.stringify(delivery.safeResponse), Date.now()],
      ),
    );
  }
  return delivery.status;
}

export async function getTransfer(transferId: string, ownerId?: string): Promise<TransferView | null> {
  return withDb(async (client) => {
    const result = await client.query(
      `${TRANSFER_SELECT} where t.id = $1 ${ownerId ? "and (t.sender_id = $2 or t.recipient_id = $2)" : ""}`,
      ownerId ? [transferId, ownerId] : [transferId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const events = await client.query(
      "select status, created_at from transfer_events where transfer_id = $1 order by created_at asc",
      [transferId],
    );
    return formatTransfer(row, events.rows);
  });
}

export async function listTransfers(userId: string, role: "sender" | "receiver") {
  return withDb(async (client) => {
    const column = role === "sender" ? "sender_id" : "recipient_id";
    const result = await client.query(
      `${TRANSFER_SELECT} where t.${column} = $1 order by t.created_at desc limit 50`,
      [userId],
    );
    const transfers: TransferView[] = [];
    for (const row of result.rows) {
      const events = await client.query(
        "select status, created_at from transfer_events where transfer_id = $1 order by created_at asc",
        [row.id],
      );
      transfers.push(formatTransfer(row, events.rows));
    }
    return transfers;
  });
}

export async function getSenderBalance(senderId: string) {
  return withDb(async (client) => {
    const result = await client.query("select balance_cents from users where id = $1 and role = 'sender'", [senderId]);
    if (!result.rows[0]) throw new Error("sender_not_found");
    return Number(result.rows[0].balance_cents ?? 0);
  });
}

export async function advanceTransfer(transferId: string, actorId: string | null, status: TransferStatus) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query("select status from transfers where id = $1 for update", [transferId]);
    const current = result.rows[0]?.status as TransferStatus | undefined;
    if (!current) throw new Error("transfer_not_found");
    if (!canTransitionTransfer(current, status)) throw new Error("invalid_status_transition");
    const now = Date.now();
    await client.query("update transfers set status = $2, updated_at = $3 where id = $1", [transferId, status, now]);
    await client.query(
      "insert into transfer_events (id, transfer_id, status, actor_id, created_at) values ($1,$2,$3,$4,$5)",
      [randomUUID(), transferId, status, actorId, now],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return getTransfer(transferId);
}

export async function reissueTransferCollectionCode(transferId: string, recipientId: string): Promise<SmsStatus> {
  const pool = getPool();
  const client = await pool.connect();
  let collectionCode = "";
  try {
    await client.query("begin");
    const result = await client.query(
      "select id from transfers where id = $1 and recipient_id = $2 and status <> 'COLLECTED' for update",
      [transferId, recipientId],
    );
    if (!result.rows[0]) throw new Error("transfer_not_found");
    const generatedCode = await generateUniqueCollectionCode(client);
    collectionCode = generatedCode.code;
    const now = Date.now();
    await client.query(
      "update transfers set collection_code_hash = $2, collection_code_expires_at = $3, updated_at = $4 where id = $1",
      [transferId, generatedCode.hash, now + COLLECTION_CODE_TTL_MS, now],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return requestTransferSms(transferId, collectionCode);
}

export async function reissueLatestTransferCollectionCode(recipientId: string): Promise<SmsStatus> {
  const latest = await withDb(async (client) => {
    const result = await client.query(
      `select id from transfers where recipient_id = $1 and status <> 'COLLECTED'
       order by created_at desc limit 1`,
      [recipientId],
    );
    return result.rows[0]?.id as string | undefined;
  });
  if (!latest) throw new Error("transfer_not_found");
  return reissueTransferCollectionCode(latest, recipientId);
}

export async function collectTransfer(transferId: string, code: string, actorId: string | null) {
  if (!/^\d{6}$/.test(code)) throw new Error("invalid_collection_code");
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query(
      "select status, collection_code_hash, collection_code_expires_at from transfers where id = $1 for update",
      [transferId],
    );
    const transfer = result.rows[0];
    if (!transfer) throw new Error("transfer_not_found");
    if (transfer.status !== "READY_TO_COLLECT") throw new Error("transfer_not_ready");
    if (Number(transfer.collection_code_expires_at) <= Date.now()) throw new Error("collection_code_expired");
    if (!validHash(code, String(transfer.collection_code_hash))) throw new Error("invalid_collection_code");
    const now = Date.now();
    await client.query("update transfers set status = 'COLLECTED', updated_at = $2 where id = $1", [transferId, now]);
    await client.query(
      "insert into transfer_events (id, transfer_id, status, actor_id, created_at) values ($1,$2,'COLLECTED',$3,$4)",
      [randomUUID(), transferId, actorId, now],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return getTransfer(transferId);
}

export async function listSmsDeliveryEvents(recipientId: string) {
  return withDb(async (client) => {
    const result = await client.query(
      `select e.transfer_id, e.status, e.provider, e.created_at
       from sms_delivery_events e
       join transfers t on t.id = e.transfer_id
       where t.recipient_id = $1
       order by e.created_at desc limit 50`,
      [recipientId],
    );
    return result.rows.map((row) => ({
      transferId: String(row.transfer_id),
      status: String(row.status),
      provider: String(row.provider),
      createdAt: new Date(Number(row.created_at)).toISOString(),
    }));
  });
}

async function getLatestSmsStatus(transferId: string): Promise<SmsStatus | null> {
  return withDb(async (client) => {
    const result = await client.query(
      "select status from sms_delivery_events where transfer_id = $1 order by created_at desc limit 1",
      [transferId],
    );
    const status = result.rows[0]?.status;
    return status === "SMS_REQUESTED" || status === "SMS_SENT" || status === "SMS_FAILED" ? status : null;
  });
}

