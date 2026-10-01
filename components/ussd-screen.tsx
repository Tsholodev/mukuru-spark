"use client";

import { useEffect, useState } from "react";
import { buildQuote, type Order, type PayWith, type Payout, type Quote } from "@/lib/engine";
import { t, type Lang } from "@/lib/copy";
import { useCorridor } from "@/components/corridor-context";
import { day, usd, zar } from "@/lib/format";

type Screen =
  | { name: "menu" }
  | { name: "amount" }
  | { name: "custom"; buffer: string }
  | { name: "payout"; amount: number }
  | { name: "review"; quote: Quote }
  | { name: "pin"; quote: Quote; payWith: PayWith; buffer: string }
  | { name: "result"; order: Order }
  | { name: "last" }
  | { name: "help" }
  | { name: "note"; body: string };

export function UssdScreen() {
  const corridor = useCorridor();
  const lang = corridor.lang;
  const [screen, setScreen] = useState<Screen>({ name: "menu" });
  const [fault, setFault] = useState<string | null>(null);

  useEffect(() => {
    setScreen({ name: "menu" });
    setFault(null);
  }, [corridor.demoId]);

  const latest = corridor.orders[0];

  async function lock(amount: number, payout: Payout) {
    setFault(null);
    const preview = buildQuote(amount, payout, Date.now(), "preview");
    if (!preview.ok) {
      setScreen({ name: "note", body: `${t(lang, "amountError")}\n\n${t(lang, "ussdBack")}` });
      return;
    }
    const quote = await corridor.requestQuote(amount, payout);
    if (!quote) {
      setScreen({
        name: "note",
        body: `${t(lang, "ussdNoSignal")}\n\n${t(lang, "ussdBack")}`,
      });
      return;
    }
    setScreen({ name: "review", quote });
  }

  async function finish(pin: string, quote: Quote, payWith: PayWith) {
    const result = await corridor.submitOrder(quote, pin, payWith);
    if (result.ok) {
      setScreen({ name: "result", order: result.order });
      return;
    }
    if (result.held || result.error === "offline") {
      setScreen({
        name: "note",
        body: `${t(lang, "ussdHeldBody")}\n\n${t(lang, "ussdMenu")}`,
      });
      return;
    }
    if (result.error === "bad_pin") {
      setFault(t(lang, "ussdWrongPin"));
      setScreen({ name: "pin", quote, payWith, buffer: "" });
      return;
    }
    setScreen({ name: "note", body: `${t(lang, "ussdNotSent")}\n\n${t(lang, "ussdMenu")}` });
  }

  function onKey(key: string) {
    setFault(null);
    if (screen.name === "menu") {
      if (key === "1") {
        if (corridor.held) setScreen({ name: "pin", quote: corridor.held.quote, payWith: corridor.held.payWith, buffer: "" });
        else setScreen({ name: "amount" });
      }
      if (key === "2") setScreen({ name: "last" });
      if (key === "3") setScreen({ name: "help" });
      return;
    }
    if (screen.name === "amount") {
      if (key === "1") void lock(200_000, "wallet");
      if (key === "2") setScreen({ name: "custom", buffer: "" });
      if (key === "0") setScreen({ name: "menu" });
      return;
    }
    if (screen.name === "custom") {
      if (key === "ok") {
        const amount = Number(screen.buffer) * 100;
        if (!screen.buffer || !Number.isInteger(amount)) return;
        setScreen({ name: "payout", amount });
        return;
      }
      if (key === "del") {
        setScreen({ name: "custom", buffer: screen.buffer.slice(0, -1) });
        return;
      }
      if (key === "0" && screen.buffer === "") {
        setScreen({ name: "amount" });
        return;
      }
      if (/^\d$/.test(key) && screen.buffer.length < 5) {
        setScreen({ name: "custom", buffer: screen.buffer + key });
      }
      return;
    }
    if (screen.name === "payout") {
      if (key === "1") void lock(screen.amount, "wallet");
      if (key === "2") void lock(screen.amount, "cash");
      if (key === "0") setScreen({ name: "amount" });
      return;
    }
    if (screen.name === "review") {
      if (key === "1") setScreen({ name: "pin", quote: screen.quote, payWith: "card", buffer: "" });
      if (key === "2") setScreen({ name: "pin", quote: screen.quote, payWith: "retail", buffer: "" });
      if (key === "0") setScreen({ name: "menu" });
      return;
    }
    if (screen.name === "pin") {
      if (key === "ok") {
        if (screen.buffer.length === 4) void finish(screen.buffer, screen.quote, screen.payWith);
        return;
      }
      if (key === "del") {
        setScreen({ ...screen, buffer: screen.buffer.slice(0, -1) });
        return;
      }
      if (key === "0" && screen.buffer === "") {
        setScreen({ name: "menu" });
        return;
      }
      if (/^\d$/.test(key) && screen.buffer.length < 4) {
        setScreen({ ...screen, buffer: screen.buffer + key });
      }
      return;
    }
    if (key === "0" || key === "ok") setScreen({ name: "menu" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#102116] text-[#D7F5B8]">
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-4 py-4 font-mono text-[15px] leading-relaxed" data-testid="ussd-screen">
        {renderScreen(screen, latest, corridor.balanceZarCents, Boolean(corridor.held), lang)}
        {fault ? `\n${fault}` : ""}
        {corridor.busy ? `\n\n${t(lang, "ussdWorking")}` : ""}
      </pre>
      <div className="grid shrink-0 grid-cols-3 gap-1.5 p-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"].map((key) => (
          <button
            key={key}
            type="button"
            data-testid={`ussd-${key}`}
            className="h-11 rounded-lg bg-[#1B3424] font-mono text-sm font-medium text-[#D7F5B8]"
            onClick={() => onKey(key)}
          >
            {key === "del" ? "⌫" : key === "ok" ? "OK" : key}
          </button>
        ))}
      </div>
    </div>
  );
}

function renderScreen(screen: Screen, latest: Order | undefined, balance: number, held: boolean, lang: Lang) {
  if (screen.name === "menu") {
    return `Mukuru *120#\n${t(lang, "ussdLive")}\nCard ${zar(balance)}\n${held ? `\n${t(lang, "ussdHeldBody").split("\n")[0]}\n${t(lang, "ussdFinish")}` : `\n${t(lang, "ussdSend")}`}\n${t(lang, "ussdLast")}\n${t(lang, "ussdHelp")}`;
  }
  if (screen.name === "amount") {
    return `Amai Rudo\n\n${t(lang, "ussdSame")}\n${t(lang, "ussdOther")}\n${t(lang, "ussdBack")}`;
  }
  if (screen.name === "custom") {
    return `${t(lang, "ussdAmount")}\nR${screen.buffer || "0"}\n\n${t(lang, "ussdTypeOk")}\n${t(lang, "ussdBack")}`;
  }
  if (screen.name === "payout") {
    return `R${(screen.amount / 100).toFixed(0)}\n\n${t(lang, "ussdWallet")}\n${t(lang, "ussdBooth")}\n${t(lang, "ussdBack")}`;
  }
  if (screen.name === "review") {
    const quote = screen.quote;
    return `${t(lang, "ussdAmaiGets")} ${usd(quote.usdOutCents)}\n${t(lang, "ussdYouPay")} ${zar(quote.amountZarCents)}\n${t(lang, "ussdFee")} ${zar(quote.feeZarCents)}\n${t(lang, quote.payout === "wallet" ? "herWallet" : "boothCash")}\n\n${t(lang, "ussdPayCard")}\n${t(lang, "ussdPayPep")}\n${t(lang, "ussdMenu")}`;
  }
  if (screen.name === "pin") {
    return `${t(lang, "ussdEnterPin")}\n${"•".repeat(screen.buffer.length)}${"-".repeat(4 - screen.buffer.length)}\n${t(lang, "ussdDemoPin")}\n\n${t(lang, "ussdOkSend")}\n${t(lang, "ussdMenu")}`;
  }
  if (screen.name === "result") {
    const order = screen.order;
    const tail = order.status === "awaiting_payment" ? t(lang, "ussdNoVoucher") : t(lang, "ussdNotReady");
    return `${t(lang, "receiptSent")} ${order.ref}\n${usd(order.usdOutCents)}\n${tail}\nCard ${zar(balance)}\n\n${t(lang, "ussdMenu")}`;
  }
  if (screen.name === "last" && latest) {
    return `${t(lang, "ussdLastTitle")}\n${latest.ref}\n${day(latest.createdAt)}\n${usd(latest.usdOutCents)}\n${t(lang, statusKey(latest.status))}\n\n${t(lang, "ussdMenu")}`;
  }
  if (screen.name === "help") {
    return `${t(lang, "ussdHelpBody")}\n\n${t(lang, "ussdMenu")}`;
  }
  if (screen.name === "note") return screen.body;
  return `${t(lang, "ussdNone")}\n\n${t(lang, "ussdMenu")}`;
}

function statusKey(status: Order["status"]) {
  if (status === "in_transit") return "inTransit" as const;
  if (status === "ready") return "ready" as const;
  if (status === "collected") return "collected" as const;
  if (status === "awaiting_payment") return "waitingPay" as const;
  return "sent" as const;
}
