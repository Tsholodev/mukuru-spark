"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Account } from "@/lib/auth";
import type { TransferView } from "@/lib/transfers";

type SmsEvent = { transferId: string; status: string; provider: string; createdAt: string };
type Inbox = { transfers: TransferView[]; smsEvents: SmsEvent[] };
type Language = "en" | "sn";

const statusText: Record<Language, Record<string, string>> = {
  en: {
    SENT: "Sent",
    IN_TRANSIT: "In transit",
    READY_TO_COLLECT: "Ready to collect",
    COLLECTED: "Collected",
  },
  sn: {
    SENT: "Yatumirwa",
    IN_TRANSIT: "Iri munzira",
    READY_TO_COLLECT: "Yagadzirira kutambirwa",
    COLLECTED: "Yatambirwa",
  },
};

function money(amountMinor: number, currency: string, language: Language) {
  return new Intl.NumberFormat(language === "sn" ? "sn-ZW" : "en-ZW", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

export function RecipientTransfers({ account }: { account: Account }) {
  const [inbox, setInbox] = useState<Inbox>({ transfers: [], smsEvents: [] });
  const [language, setLanguage] = useState<Language>(account.preferredLanguage);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    const poll = async () => {
      try {
        const response = await fetch("/api/inbox", { cache: "no-store" });
        if (response.status === 401) {
          window.location.href = "/";
          return;
        }
        if (!response.ok) throw new Error("inbox_unavailable");
        setInbox(await response.json());
        setError("");
      } catch {
        setError(language === "sn" ? "Hatina kukwanisa kuvandudza. Tarisa network." : "Could not refresh transfers. Check the connection.");
      } finally {
        setLoaded(true);
      }
      if (!stopped) timer = window.setTimeout(poll, 5_000);
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [language]);

  async function changeLanguage(next: Language) {
    setLanguage(next);
    await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: next }),
    });
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <main className="min-h-dvh bg-[#F4F7F4] px-4 py-6 text-[#202820]">
      <div className="mx-auto max-w-xl">
        <header className="flex items-center justify-between gap-4 border-b border-[#D8E2DA] pb-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-[#3E6B52]">SENDA · TRANSFERS</p>
            <h1 className="mt-1 text-2xl font-semibold">{language === "sn" ? "Mhoro" : "Hello"}, {account.name}</h1>
          </div>
          <button type="button" className="h-11 rounded-lg bg-[#26372C] px-4 font-semibold text-white" onClick={() => void signOut()}>
            {language === "sn" ? "Buda" : "Sign out"}
          </button>
        </header>

        <div className="mt-4 flex gap-2" role="group" aria-label="Preferred language">
          <button type="button" aria-pressed={language === "en"} className="h-10 rounded-lg border border-[#C8D5CB] bg-white px-4 text-sm font-semibold aria-pressed:bg-[#24543A] aria-pressed:text-white" onClick={() => void changeLanguage("en")}>English</button>
          <button type="button" aria-pressed={language === "sn"} className="h-10 rounded-lg border border-[#C8D5CB] bg-white px-4 text-sm font-semibold aria-pressed:bg-[#24543A] aria-pressed:text-white" onClick={() => void changeLanguage("sn")}>ChiShona</button>
        </div>

        {error && <p role="status" className="mt-4 rounded-lg border border-[#B94A3A] bg-white p-3 text-sm">{error}</p>}
        <section className="mt-5" aria-labelledby="transfers-heading">
          <h2 id="transfers-heading" className="text-lg font-semibold">{language === "sn" ? "Mari yakatumirwa kwauri" : "Money sent to you"}</h2>
          {!loaded && <p className="mt-3 text-sm text-[#637368]">{language === "sn" ? "Tichitarisa…" : "Checking for transfers…"}</p>}
          {loaded && inbox.transfers.length === 0 && (
            <p className="mt-3 border-y border-[#D8E2DA] py-5 text-sm text-[#637368]">
              {language === "sn" ? "Hapana transfer parizvino." : "No transfers yet."}
            </p>
          )}
          <ul className="mt-3 divide-y divide-[#D8E2DA] border-y border-[#D8E2DA]">
            {inbox.transfers.map((transfer) => {
              const sms = inbox.smsEvents.find((event) => event.transferId === transfer.id);
              return (
                <li key={transfer.id} className="py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{transfer.senderName}</p>
                      <p className="mt-1 text-sm text-[#526055]">{money(transfer.destinationAmountMinor, transfer.destinationCurrency, language)}</p>
                      <p className="mt-1 break-all font-mono text-xs text-[#637368]">{transfer.id}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold">{statusText[language][transfer.status] ?? transfer.status}</span>
                  </div>
                  <p className="mt-3 text-sm text-[#526055]">
                    {language === "sn" ? "Kodhi yekutora" : "Collection code"}: {language === "sn" ? "Yatumirwa neSMS kana yakagadzirira." : "Sent by SMS when the transfer is ready."}
                  </p>
                  {sms && (
                    <p className="mt-2 text-xs text-[#637368]">
                      {sms.status === "SMS_SENT"
                        ? language === "sn" ? "SMS yatumirwa." : "SMS accepted by provider."
                        : sms.status === "SMS_FAILED"
                          ? language === "sn" ? "SMS haina kutumirwa." : "SMS delivery failed."
                          : language === "sn" ? "SMS iri kukumbirwa; haisati yasimbiswa." : "SMS requested; delivery is not confirmed."}
                    </p>
                  )}
                  <ol className="mt-4 grid gap-2 border-l-2 border-[#C8D5CB] pl-4 sm:grid-cols-4 sm:border-l-0 sm:border-t-2 sm:pl-0 sm:pt-3">
                    {transfer.events.map((event) => (
                      <li key={`${transfer.id}-${event.status}-${event.createdAt}`} className="text-xs text-[#526055]">
                        <span className="font-semibold">{statusText[language][event.status] ?? event.status}</span>
                        <time className="mt-1 block text-[#7B887E]">{new Date(event.createdAt).toLocaleString()}</time>
                      </li>
                    ))}
                  </ol>
                  {transfer.status === "READY_TO_COLLECT" && transfer.collectionLocation && (
                    <p className="mt-3 rounded-lg bg-white p-3 text-sm leading-relaxed">
                      {language === "sn" ? "Tora mari pa" : "Collect at"} {transfer.collectionLocation}. {language === "sn" ? "Ratidza SMS yako." : "Show your SMS and transfer ID."}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        <Link href="/ussd" className="mt-5 inline-flex h-12 items-center rounded-lg bg-[#24543A] px-4 font-semibold text-white">USSD</Link>
      </div>
    </main>
  );
}