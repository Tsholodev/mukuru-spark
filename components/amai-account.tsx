"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Order } from "@/lib/engine";
import { t, type Lang } from "@/lib/copy";
import { usd, zar } from "@/lib/format";
import { StatusTrack } from "@/components/status-track";

type Inbox = {
  account: { name: string; lang: Lang };
  orders: Order[];
};

export function AmaiAccount() {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/inbox", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/";
      return;
    }
    if (!response.ok) {
      setError("The account could not be opened.");
      return;
    }
    setInbox(await response.json());
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 2000);
    return () => window.clearInterval(timer);
  }, []);

  const lang = inbox?.account.lang ?? "en";
  const active = inbox?.orders.find((order) => !order.idempotencyKey.startsWith("seed-"));

  async function collect() {
    if (!active) return;
    await fetch(`/api/orders/${active.ref}/collect`, { method: "POST" });
    await load();
  }

  async function choose(next: Lang) {
    await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: next }),
    });
    await load();
  }

  return (
    <main className="min-h-dvh bg-[#F7FBF8] px-4 py-6 text-[#241910]">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-[#3E6B52]">AMAI · HARARE</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t(lang, "mhoroAmai")}</h1>
        </div>
        <button
          type="button"
          className="h-12 rounded-full bg-[#241910] px-4 font-semibold text-white"
          onClick={() => {
            void fetch("/api/auth/logout", { method: "POST" }).then(() => {
              window.location.href = "/";
            });
          }}
        >
          Sign out
        </button>
      </div>
      <div className="mx-auto mt-4 flex max-w-md gap-2">
        <button type="button" className="h-12 flex-1 rounded-full bg-white font-semibold" onClick={() => void choose("en")}>
          English
        </button>
        <button type="button" className="h-12 flex-1 rounded-full bg-white font-semibold" onClick={() => void choose("sn")}>
          ChiShona
        </button>
      </div>
      <section className="mx-auto mt-4 max-w-md rounded-[1.5rem] bg-white p-5 shadow-sm">
        {error && <p>{error}</p>}
        {!inbox && <p>{t(lang, "looking")}</p>}
        {inbox && !active && (
          <div data-testid="amai-empty">
            <p className="text-2xl font-semibold">{t(lang, "nothingNew")}</p>
            <p className="mt-3 text-lg leading-relaxed">{t(lang, "screenshot")}</p>
          </div>
        )}
        {active && <Active order={active} lang={lang} onCollect={() => void collect()} />}
      </section>
      <Link href="/ussd" className="mx-auto mt-4 flex h-14 max-w-md items-center justify-center rounded-full bg-[#102116] text-lg font-semibold text-[#D7F5B8]">
        USSD *120#
      </Link>
    </main>
  );
}

function Active({ order, lang, onCollect }: { order: Order; lang: Lang; onCollect: () => void }) {
  if (order.status === "awaiting_payment" || !order.paidAt) {
    return (
      <div data-testid="amai-status">
        <p className="text-2xl font-semibold">{t(lang, "notPaidTitle")}</p>
        <p className="mt-3 text-lg">{t(lang, "notPaidBody")}</p>
      </div>
    );
  }
  if (order.status === "sent" || order.status === "in_transit") {
    return (
      <div data-testid="amai-status">
        <p className="text-4xl font-semibold tabular-nums">{usd(order.usdOutCents)}</p>
        <div className="mt-4">
          <StatusTrack status={order.status} lang={lang} icons />
        </div>
        <p className="mt-4 text-lg">{t(lang, "onTheWay")}</p>
      </div>
    );
  }
  const ready = order.status === "ready";
  return (
    <div data-testid="amai-status">
      <p className="text-2xl font-semibold" data-testid="ready-notice">
        {ready ? t(lang, "readyNotice") : t(lang, "collected")}
      </p>
      <p className="mt-2 text-lg">{ready ? t(lang, "readyNoticeSn") : t(lang, "collected")}</p>
      <div className="mt-4">
        <StatusTrack status={order.status} lang={lang} icons />
      </div>
      <p className="mt-4 text-5xl font-semibold tabular-nums">{usd(order.usdOutCents)}</p>
      <p className="mt-2 font-mono text-3xl">{order.ref}</p>
      <p className="mt-4 text-lg">{t(lang, "fromThandiCard", { amount: zar(order.amountZarCents) })}</p>
      {ready && (
        <button type="button" data-testid="amai-collect" className="mt-4 h-14 w-full rounded-full bg-[#241910] text-lg font-semibold text-white" onClick={onCollect}>
          {t(lang, "collectedBtn")}
        </button>
      )}
    </div>
  );
}
