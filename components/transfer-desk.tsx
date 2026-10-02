"use client";

import { useEffect, useState } from "react";
import type { Account } from "@/lib/auth";

type Recipient = {
  id: string;
  name: string;
  maskedPhoneNumber: string;
  country: string | null;
  preferredLanguage: "en" | "sn";
};

type Quote = {
  id: string;
  recipient: Recipient;
  amountMinor: number;
  sourceCurrency: string;
  destinationAmountMinor: number;
  destinationCurrency: string;
  exchangeRate: number;
  feeMinor: number;
  collectionLocation: string;
  expiresAt: string;
};

type Transfer = {
  id: string;
  recipientName: string;
  amountMinor: number;
  sourceCurrency: string;
  destinationAmountMinor: number;
  destinationCurrency: string;
  exchangeRate: number;
  feeMinor: number;
  collectionLocation: string;
  status: string;
  createdAt: string;
  events: { status: string; createdAt: string }[];
};

type TransferReceipt = { transfer: Transfer; smsStatus: string | null };

function toMinorUnits(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function money(amountMinor: number, currency: string, language = "en") {
  return new Intl.NumberFormat(language === "sn" ? "sn-ZW" : "en-ZW", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

export function TransferDesk({ account }: { account: Account }) {
  const [phone, setPhone] = useState("");
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [availableBalanceMinor, setAvailableBalanceMinor] = useState<number | null>(null);
  const [balanceCurrency, setBalanceCurrency] = useState("");
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshTransfers() {
    const response = await fetch("/api/transfers", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/";
      return;
    }
    if (!response.ok) throw new Error("transfers_unavailable");
    const result = await response.json();
    setTransfers(result.transfers);
    setAvailableBalanceMinor(result.availableBalanceMinor);
    setBalanceCurrency(result.sourceCurrency ?? "");
  }

  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    const poll = async () => {
      try {
        await refreshTransfers();
      } catch {
        if (!stopped) setError("Transfers could not be refreshed. Check the connection.");
      }
      if (!stopped) timer = window.setTimeout(poll, 5_000);
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  async function findRecipient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setQuote(null);
    setRecipient(null);
    try {
      const response = await fetch(`/api/recipients?phone=${encodeURIComponent(phone)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "recipient_lookup_failed");
      setRecipient(result.recipient);
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "recipient_not_found"
        ? "No registered recipient matches that number. Ask them to create an account first."
        : "No registered recipient found. Check the number and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function requestQuote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recipient) return;
    const amountMinor = toMinorUnits(amount);
    if (!amountMinor) {
      setError("Enter an amount greater than zero, with up to two decimal places.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: recipient.id, amountMinor }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "quote_failed");
      setQuote(result.quote);
      setConfirmed(false);
      setIdempotencyKey(crypto.randomUUID());
      setReceipt(null);
    } catch {
      setError("A quote is not available right now. Check the amount and exchange-rate service, then retry.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmTransfer() {
    if (!quote || !confirmed || !idempotencyKey) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.id, idempotencyKey, confirmed: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "transfer_failed");
      setReceipt({ transfer: result.transfer, smsStatus: result.smsStatus });
      setQuote(null);
      setConfirmed(false);
      setAmount("");
      await refreshTransfers();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "transfer_failed";
      setError(message === "quote_expired"
        ? "This quote expired. Request a fresh rate and confirm again."
        : "The transfer could not be confirmed. Nothing was submitted; review and retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#F4F7F4] px-4 py-6 text-[#202820]">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-[#D8E2DA] pb-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-[#3E6B52]">SENDA · TRANSFER</p>
            <h1 className="mt-1 text-2xl font-semibold">Hello, {account.name}</h1>
          </div>
          <button type="button" className="h-11 rounded-lg bg-[#26372C] px-4 font-semibold text-white" onClick={() => void fetch("/api/auth/logout", { method: "POST" }).then(() => { window.location.href = "/"; })}>
            Sign out
          </button>
        </header>

        {error && <p role="alert" className="mt-4 rounded-lg border border-[#B94A3A] bg-white p-3 text-sm text-[#8E3025]">{error}</p>}

        {!receipt && !quote && (
          <section className="mt-5 border-b border-[#D8E2DA] pb-6" aria-labelledby="send-title">
            <h2 id="send-title" className="text-lg font-semibold">Send to a registered recipient</h2>
            {availableBalanceMinor != null && balanceCurrency && (
              <p className="mt-2 text-sm text-[#526055]">Available balance: {money(availableBalanceMinor, balanceCurrency, account.preferredLanguage)}</p>
            )}
            {!recipient ? (
              <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => void findRecipient(event)}>
                <label className="flex-1 text-sm font-medium">
                  Recipient phone number
                  <input required type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 h-12 w-full rounded-lg border border-[#C8D5CB] bg-white px-3 text-base outline-none focus:border-[#3E6B52]" />
                </label>
                <button disabled={busy} className="h-12 self-end rounded-lg bg-[#26372C] px-5 font-semibold text-white disabled:opacity-50">
                  {busy ? "Searching…" : "Find recipient"}
                </button>
              </form>
            ) : (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-[#C8D5CB] bg-white p-4">
                  <div>
                    <p className="font-semibold">{recipient.name}</p>
                    <p className="mt-1 text-sm text-[#526055]">{recipient.maskedPhoneNumber}{recipient.country ? ` · ${recipient.country}` : ""}</p>
                  </div>
                  <button type="button" className="h-10 rounded-lg px-3 text-sm font-semibold text-[#3E6B52]" onClick={() => { setRecipient(null); setQuote(null); }}>
                    Change
                  </button>
                </div>
                <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => void requestQuote(event)}>
                  <label className="flex-1 text-sm font-medium">
                    Amount to send
                    <input required inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 h-12 w-full rounded-lg border border-[#C8D5CB] bg-white px-3 text-lg tabular-nums outline-none focus:border-[#3E6B52]" />
                  </label>
                  <button disabled={busy} className="h-12 self-end rounded-lg bg-[#24543A] px-5 font-semibold text-white disabled:opacity-50">
                    {busy ? "Getting rate…" : "Review transfer"}
                  </button>
                </form>
              </div>
            )}
          </section>
        )}

        {quote && (
          <section className="mt-5 border-b border-[#D8E2DA] pb-6" aria-labelledby="review-title">
            <h2 id="review-title" className="text-lg font-semibold">Review before sending</h2>
            <dl className="mt-3 divide-y divide-[#E2E9E3] rounded-lg border border-[#D8E2DA] bg-white px-4">
              <Row label="Recipient" value={`${quote.recipient.name} · ${quote.recipient.maskedPhoneNumber}`} />
              <Row label="You send" value={money(quote.amountMinor, quote.sourceCurrency, account.preferredLanguage)} />
              <Row label="They receive" value={money(quote.destinationAmountMinor, quote.destinationCurrency, account.preferredLanguage)} />
              <Row label="Exchange rate" value={`1 ${quote.sourceCurrency} = ${quote.exchangeRate.toPrecision(6)} ${quote.destinationCurrency}`} />
              <Row label="Fee" value={money(quote.feeMinor, quote.sourceCurrency, account.preferredLanguage)} />
              <Row label="Collection" value={quote.collectionLocation} />
              <Row label="Quote expires" value={new Date(quote.expiresAt).toLocaleString()} />
            </dl>
            <label className="mt-4 flex items-start gap-3 text-sm leading-relaxed">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-[#24543A]" />
              <span>I confirm this recipient and amount, and authorize this transfer.</span>
            </label>
            <div className="mt-4 flex gap-3">
              <button type="button" className="h-12 rounded-lg border border-[#C8D5CB] px-4 font-semibold" onClick={() => setQuote(null)}>
                Edit
              </button>
              <button type="button" disabled={busy || !confirmed || (availableBalanceMinor != null && quote.amountMinor > availableBalanceMinor)} className="h-12 flex-1 rounded-lg bg-[#24543A] px-4 font-semibold text-white disabled:opacity-50" onClick={() => void confirmTransfer()}>
                {busy ? "Confirming…" : "Confirm transfer"}
              </button>
            </div>
          </section>
        )}

        {receipt && <Receipt receipt={receipt} language={account.preferredLanguage} onDismiss={() => setReceipt(null)} />}

        <section className="mt-6" aria-labelledby="history-title">
          <h2 id="history-title" className="text-lg font-semibold">Your transfers</h2>
          {transfers.length ? (
            <ul className="mt-3 divide-y divide-[#D8E2DA] border-y border-[#D8E2DA]">
              {transfers.map((transfer) => (
                <li key={transfer.id} className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{transfer.recipientName}</p>
                      <p className="mt-1 text-sm text-[#526055]">{money(transfer.amountMinor, transfer.sourceCurrency, account.preferredLanguage)} · {money(transfer.destinationAmountMinor, transfer.destinationCurrency, account.preferredLanguage)}</p>
                      <p className="mt-1 break-all font-mono text-xs text-[#637368]">{transfer.id}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold">{transfer.status.replaceAll("_", " ")}</span>
                  </div>
                  <p className="mt-2 text-xs text-[#637368]">{new Date(transfer.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[#637368]">No transfers yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-[#637368]">{label}</dt><dd className="text-right font-semibold tabular-nums">{value}</dd></div>;
}

function Receipt({ receipt, language, onDismiss }: { receipt: TransferReceipt; language: "en" | "sn"; onDismiss: () => void }) {
  const transfer = receipt.transfer;
  const smsMessage = receipt.smsStatus === "SMS_SENT"
    ? "SMS accepted by the provider."
    : receipt.smsStatus === "SMS_FAILED"
      ? "SMS delivery failed. The transfer is recorded; contact the recipient before proceeding."
      : "SMS requested. No provider is configured, so no handset delivery is claimed.";
  return (
    <section className="mt-5 border-b border-[#D8E2DA] pb-6" aria-labelledby="receipt-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="receipt-title" className="text-lg font-semibold">Transfer receipt</h2>
          <p className="mt-1 text-sm text-[#526055]">{transfer.status.replaceAll("_", " ")}</p>
        </div>
        <button type="button" className="text-sm font-semibold text-[#3E6B52]" onClick={onDismiss}>Close</button>
      </div>
      <dl className="mt-3 divide-y divide-[#E2E9E3] rounded-lg border border-[#D8E2DA] bg-white px-4">
        <Row label="Transfer ID" value={transfer.id} />
        <Row label="Recipient" value={transfer.recipientName} />
        <Row label="You sent" value={money(transfer.amountMinor, transfer.sourceCurrency, language)} />
        <Row label="They receive" value={money(transfer.destinationAmountMinor, transfer.destinationCurrency, language)} />
        <Row label="Created" value={new Date(transfer.createdAt).toLocaleString()} />
        <Row label="Notification" value={smsMessage} />
      </dl>
    </section>
  );
}