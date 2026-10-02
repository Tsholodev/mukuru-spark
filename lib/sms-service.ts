export type SmsStatus = "SMS_REQUESTED" | "SMS_SENT" | "SMS_FAILED";

export type TransferNotification = {
  transferId: string;
  senderName: string;
  recipientPhoneNumber: string;
  recipientPreferredLanguage: "en" | "sn";
  destinationAmountMinor: number;
  destinationCurrency: string;
  collectionCode: string;
  collectionLocation: string;
  ussdCode: string;
};

export type SmsResult = {
  status: SmsStatus;
  provider: string;
  providerMessageId: string | null;
  safeResponse: Record<string, string | number | boolean | null>;
};

export interface SmsService {
  sendTransferNotification(transfer: TransferNotification): Promise<SmsResult>;
}

export function buildTransferNotificationMessage(transfer: TransferNotification) {
  const locale = transfer.recipientPreferredLanguage === "sn" ? "sn-ZW" : "en-ZW";
  const amount = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: transfer.destinationCurrency,
  }).format(transfer.destinationAmountMinor / 100);

  if (transfer.recipientPreferredLanguage === "sn") {
    return `Senda: ${transfer.senderName} akutumira ${amount}. Kodhi ${transfer.collectionCode}; tora pa${transfer.collectionLocation} kana yagadzirira. Inopera mumaawa 24. Kodhi itsva: daira ${transfer.ussdCode}. Usaipe munhu.`;
  }
  return `Senda: ${transfer.senderName} sent ${amount}. Pickup code ${transfer.collectionCode} at ${transfer.collectionLocation} when ready. Expires in 24h. New code: dial ${transfer.ussdCode}. Never share it.`;
}

class DevelopmentSmsService implements SmsService {
  async sendTransferNotification(transfer: TransferNotification): Promise<SmsResult> {
    console.info("SMS requested in development", {
      transferId: transfer.transferId,
      recipient: maskPhoneNumber(transfer.recipientPhoneNumber),
      provider: "development",
    });
    return {
      status: "SMS_REQUESTED",
      provider: "development",
      providerMessageId: null,
      safeResponse: { reason: "live_provider_not_configured" },
    };
  }
}

class TwilioSmsService implements SmsService {
  async sendTransferNotification(transfer: TransferNotification): Promise<SmsResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;
    if (!accountSid || !authToken || !from) {
      return {
        status: "SMS_FAILED",
        provider: "twilio",
        providerMessageId: null,
        safeResponse: { reason: "provider_configuration_incomplete" },
      };
    }

    try {
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: from,
          To: transfer.recipientPhoneNumber,
          Body: buildTransferNotificationMessage(transfer),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        return {
          status: "SMS_FAILED",
          provider: "twilio",
          providerMessageId: null,
          safeResponse: { httpStatus: response.status },
        };
      }
      const result = (await response.json()) as { sid?: string };
      return {
        status: "SMS_SENT",
        provider: "twilio",
        providerMessageId: result.sid ?? null,
        safeResponse: { httpStatus: response.status },
      };
    } catch {
      return {
        status: "SMS_FAILED",
        provider: "twilio",
        providerMessageId: null,
        safeResponse: { reason: "provider_request_failed" },
      };
    }
  }
}

export function createSmsService(): SmsService {
  const values = [process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, process.env.TWILIO_FROM];
  if (values.every((value) => !value)) return new DevelopmentSmsService();
  return new TwilioSmsService();
}

function maskPhoneNumber(phoneNumber: string) {
  return `••••${phoneNumber.replace(/\D/g, "").slice(-4)}`;
}