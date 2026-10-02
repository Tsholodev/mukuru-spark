import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { getPool, readyDb } from "./db.ts";
import {
  advanceTransfer,
  collectTransfer,
  confirmTransfer,
  createTransferQuote,
  listSmsDeliveryEvents,
} from "./transfers.ts";

const testDatabaseUrl = process.env.TRANSFER_TEST_DATABASE_URL;

it("persists a registered-recipient transfer through SMS and collection", { skip: !testDatabaseUrl }, async () => {
  const previous = {
    databaseUrl: process.env.DATABASE_URL,
    collectionSecret: process.env.COLLECTION_CODE_SECRET,
    sourceCurrency: process.env.SOURCE_CURRENCY,
    destinationCurrency: process.env.DESTINATION_CURRENCY,
    feeBasisPoints: process.env.TRANSFER_FEE_BPS,
    location: process.env.TRANSFER_COLLECTION_LOCATION,
    rateApi: process.env.EXCHANGE_RATE_API_URL,
    twilioSid: process.env.TWILIO_ACCOUNT_SID,
    twilioToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFrom: process.env.TWILIO_FROM,
    fetch: globalThis.fetch,
  };
  const senderId = randomUUID();
  const recipientId = randomUUID();
  let transferId: string | undefined;
  let quoteId: string | undefined;
  let notificationBody = "";

  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.COLLECTION_CODE_SECRET = "integration-test-only-secret";
  process.env.SOURCE_CURRENCY = "ZAR";
  process.env.DESTINATION_CURRENCY = "USD";
  process.env.TRANSFER_FEE_BPS = "100";
  process.env.TRANSFER_COLLECTION_LOCATION = "Participating store";
  process.env.EXCHANGE_RATE_API_URL = "https://rates.invalid/latest";
  process.env.TWILIO_ACCOUNT_SID = "integration-account";
  process.env.TWILIO_AUTH_TOKEN = "integration-token";
  process.env.TWILIO_FROM = "+15005550006";
  globalThis.fetch = async (input, init) => {
    if (String(input).includes("api.twilio.com")) {
      notificationBody = new URLSearchParams(String(init?.body ?? "")).get("Body") ?? "";
      return new Response(JSON.stringify({ sid: "SM-integration" }), { status: 201 });
    }
    return new Response(JSON.stringify({ result: "success", rates: { USD: 1.5 } }), { status: 200 });
  };

  try {
    await readyDb();
    const pool = getPool();
    const senderPhone = `+2711${String(Date.now()).slice(-7)}`;
    const recipientPhone = `+26377${String(Date.now()).slice(-7)}`;
    await pool.query(
      `insert into users (
        id, role, name, phone, phone_number, password_hash, city, country, lang,
        preferred_language, balance_cents, pin_misses
      ) values
        ($1,'sender','Integration sender',$3,$3,'not-used','Johannesburg','ZA','en','en',500000,0),
        ($2,'receiver','Integration recipient',$4,$4,'not-used','Harare','ZW','sn','sn',0,0)`,
      [senderId, recipientId, senderPhone, recipientPhone],
    );

    await assert.rejects(createTransferQuote(senderId, recipientId, 0), /invalid_amount/);
    await assert.rejects(createTransferQuote(senderId, randomUUID(), 100_000), /recipient_not_found/);

    const quote = await createTransferQuote(senderId, recipientId, 200_000);
    quoteId = quote.id;
    const idempotencyKey = randomUUID();
    const first = await confirmTransfer(senderId, quote.id, idempotencyKey, true);
    transferId = first.transfer.id;
    assert.equal(first.created, true);
    assert.equal(first.transfer.status, "SENT");
    assert.equal(first.smsStatus, "SMS_SENT");
    assert.match(first.transfer.id, /^[0-9a-f-]{36}$/i);
    assert.match(notificationBody, /Integration sender/);
    assert.match(notificationBody, /Integration recipient|Pickup code/);

    const retry = await confirmTransfer(senderId, quote.id, idempotencyKey, true);
    assert.equal(retry.created, false);
    assert.equal(retry.transfer.id, first.transfer.id);

    await assert.rejects(confirmTransfer(senderId, quote.id, randomUUID(), true), /quote_already_used/);
    await assert.rejects(advanceTransfer(first.transfer.id, senderId, "READY_TO_COLLECT"), /invalid_status_transition/);
    await advanceTransfer(first.transfer.id, senderId, "IN_TRANSIT");
    await advanceTransfer(first.transfer.id, senderId, "READY_TO_COLLECT");

    const code = /Pickup code (\d{6})/.exec(notificationBody)?.[1];
    assert.ok(code);
    const collected = await collectTransfer(first.transfer.id, code, null);
    assert.equal(collected?.status, "COLLECTED");
    assert.deepEqual(collected?.events.map((event) => event.status), ["SENT", "IN_TRANSIT", "READY_TO_COLLECT", "COLLECTED"]);
    const smsEvents = await listSmsDeliveryEvents(recipientId);
    assert.deepEqual(smsEvents.map((event) => event.status).sort(), ["SMS_REQUESTED", "SMS_SENT"]);

    const balance = await pool.query("select balance_cents from users where id = $1", [senderId]);
    assert.equal(Number(balance.rows[0].balance_cents), 300_000);
  } finally {
    const pool = getPool();
    if (transferId) {
      await pool.query("delete from sms_delivery_events where transfer_id = $1", [transferId]);
      await pool.query("delete from transfer_events where transfer_id = $1", [transferId]);
      await pool.query("delete from transfers where id = $1", [transferId]);
    }
    if (quoteId) await pool.query("delete from transfer_quotes where id = $1", [quoteId]);
    await pool.query("delete from users where id in ($1, $2)", [senderId, recipientId]);
    await pool.end();

    if (previous.databaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous.databaseUrl;
    if (previous.collectionSecret === undefined) delete process.env.COLLECTION_CODE_SECRET;
    else process.env.COLLECTION_CODE_SECRET = previous.collectionSecret;
    if (previous.sourceCurrency === undefined) delete process.env.SOURCE_CURRENCY;
    else process.env.SOURCE_CURRENCY = previous.sourceCurrency;
    if (previous.destinationCurrency === undefined) delete process.env.DESTINATION_CURRENCY;
    else process.env.DESTINATION_CURRENCY = previous.destinationCurrency;
    if (previous.feeBasisPoints === undefined) delete process.env.TRANSFER_FEE_BPS;
    else process.env.TRANSFER_FEE_BPS = previous.feeBasisPoints;
    if (previous.location === undefined) delete process.env.TRANSFER_COLLECTION_LOCATION;
    else process.env.TRANSFER_COLLECTION_LOCATION = previous.location;
    if (previous.rateApi === undefined) delete process.env.EXCHANGE_RATE_API_URL;
    else process.env.EXCHANGE_RATE_API_URL = previous.rateApi;
    if (previous.twilioSid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
    else process.env.TWILIO_ACCOUNT_SID = previous.twilioSid;
    if (previous.twilioToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = previous.twilioToken;
    if (previous.twilioFrom === undefined) delete process.env.TWILIO_FROM;
    else process.env.TWILIO_FROM = previous.twilioFrom;
    globalThis.fetch = previous.fetch;
  }
});
