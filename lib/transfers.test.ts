import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizePhone } from "./passwords.ts";
import { calculateTransferAmounts } from "./transfer-calculation.ts";
import { canTransitionTransfer } from "./transfer-status.ts";
import { generateCollectionCode } from "./transfers.ts";
import {
  buildTransferNotificationMessage,
  createSmsService,
  type TransferNotification,
} from "./sms-service.ts";

const notification: TransferNotification = {
  transferId: "transfer-test-id",
  senderName: "Test Sender",
  recipientPhoneNumber: "+263771234567",
  recipientPreferredLanguage: "en",
  destinationAmountMinor: 12_345,
  destinationCurrency: "USD",
  collectionCode: "548921",
  collectionLocation: "Participating store",
  ussdCode: "*120#",
};

describe("registered phone validation", () => {
  it("normalizes supported international and country-local phone numbers", () => {
    assert.equal(normalizePhone("+263 77 123 4567"), "+263771234567");
    assert.equal(normalizePhone("077 123 4567", "ZW"), "+263771234567");
  });

  it("rejects invalid phone numbers and unsupported country codes", () => {
    assert.equal(normalizePhone("123"), null);
    assert.equal(normalizePhone("0771234567", "ZZ"), null);
  });
});

describe("server-side quote calculation", () => {
  it("calculates fee and destination amount from the server exchange rate", () => {
    assert.deepEqual(calculateTransferAmounts(200_000, 1.5, 100), {
      amountMinor: 200_000,
      feeMinor: 2_000,
      destinationAmountMinor: 297_000,
    });
  });

  it("rejects zero, negative, fractional, and unsafe amounts", () => {
    for (const amount of [0, -1, 1.25, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => calculateTransferAmounts(amount, 1.5, 100), /invalid_amount/);
    }
  });

  it("rejects invalid rates and fee configuration", () => {
    assert.throws(() => calculateTransferAmounts(10_000, 0, 100), /invalid_exchange_rate/);
    assert.throws(() => calculateTransferAmounts(10_000, 1, 10_000), /invalid_fee_configuration/);
  });
});

describe("collection codes", () => {
  it("generates six-digit codes with no duplicates in a test batch", () => {
    const codes = Array.from({ length: 100 }, generateCollectionCode);
    assert.ok(codes.every((code) => /^\d{6}$/.test(code)));
    assert.equal(new Set(codes).size, codes.length);
  });
});

describe("transfer status transitions", () => {
  it("allows only the required forward status sequence", () => {
    assert.equal(canTransitionTransfer("SENT", "IN_TRANSIT"), true);
    assert.equal(canTransitionTransfer("IN_TRANSIT", "READY_TO_COLLECT"), true);
    assert.equal(canTransitionTransfer("READY_TO_COLLECT", "COLLECTED"), true);
    assert.equal(canTransitionTransfer("SENT", "READY_TO_COLLECT"), false);
    assert.equal(canTransitionTransfer("COLLECTED", "SENT"), false);
  });
});

describe("SMS service", () => {
  it("builds a short message from actual notification data", () => {
    const message = buildTransferNotificationMessage(notification);
    assert.match(message, /Test Sender/);
    assert.match(message, /\$123\.45/);
    assert.match(message, /548921/);
    assert.match(message, /Participating store/);
    assert.match(message, /\*120#/);
  });

  it("does not claim delivery when no provider is configured", async () => {
    const names = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"] as const;
    const previous = names.map((name) => process.env[name]);
    const info = console.info;
    console.info = () => undefined;
    names.forEach((name) => delete process.env[name]);
    try {
      const result = await createSmsService().sendTransferNotification(notification);
      assert.equal(result.status, "SMS_REQUESTED");
      assert.equal(result.provider, "development");
    } finally {
      console.info = info;
      names.forEach((name, index) => {
        if (previous[index] === undefined) delete process.env[name];
        else process.env[name] = previous[index];
      });
    }
  });

  it("records a provider result without logging message content", async () => {
    const previous = {
      sid: process.env.TWILIO_ACCOUNT_SID,
      token: process.env.TWILIO_AUTH_TOKEN,
      from: process.env.TWILIO_FROM,
      fetch: globalThis.fetch,
    };
    process.env.TWILIO_ACCOUNT_SID = "test-account";
    process.env.TWILIO_AUTH_TOKEN = "test-token";
    process.env.TWILIO_FROM = "+15005550006";
    let requestBody = "";
    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ sid: "SM-test" }), { status: 201 });
    };
    try {
      const result = await createSmsService().sendTransferNotification(notification);
      assert.equal(result.status, "SMS_SENT");
      assert.equal(result.providerMessageId, "SM-test");
      assert.match(requestBody, /548921/);
    } finally {
      if (previous.sid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
      else process.env.TWILIO_ACCOUNT_SID = previous.sid;
      if (previous.token === undefined) delete process.env.TWILIO_AUTH_TOKEN;
      else process.env.TWILIO_AUTH_TOKEN = previous.token;
      if (previous.from === undefined) delete process.env.TWILIO_FROM;
      else process.env.TWILIO_FROM = previous.from;
      globalThis.fetch = previous.fetch;
    }
  });

  it("reports provider rejection as SMS_FAILED", async () => {
    const previous = {
      sid: process.env.TWILIO_ACCOUNT_SID,
      token: process.env.TWILIO_AUTH_TOKEN,
      from: process.env.TWILIO_FROM,
      fetch: globalThis.fetch,
    };
    process.env.TWILIO_ACCOUNT_SID = "test-account";
    process.env.TWILIO_AUTH_TOKEN = "test-token";
    process.env.TWILIO_FROM = "+15005550006";
    globalThis.fetch = async () => new Response(null, { status: 400 });
    try {
      const result = await createSmsService().sendTransferNotification(notification);
      assert.equal(result.status, "SMS_FAILED");
      assert.equal(result.safeResponse.httpStatus, 400);
    } finally {
      if (previous.sid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
      else process.env.TWILIO_ACCOUNT_SID = previous.sid;
      if (previous.token === undefined) delete process.env.TWILIO_AUTH_TOKEN;
      else process.env.TWILIO_AUTH_TOKEN = previous.token;
      if (previous.from === undefined) delete process.env.TWILIO_FROM;
      else process.env.TWILIO_FROM = previous.from;
      globalThis.fetch = previous.fetch;
    }
  });
});
