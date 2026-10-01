"use client";

import { useEffect, useState } from "react";
import { buildQuote, type Order, type PayWith, type Payout, type Quote } from "@/lib/engine";
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
      setScreen({ name: "note", body: "Amount must be from R100 to R5 000.\n\n0 Back" });
      return;
    }
    const quote = await corridor.requestQuote(amount, payout);
    if (!quote) {
      setScreen({
        name: "note",
        body: "NO SIGNAL\nRate not locked.\nCard not touched.\n\n0 Back",
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
        body: "HELD ON PHONE\nMoney has not left.\nAmai has not been told.\nSame order when signal returns.\n\n0 Menu",
      });
      return;
    }
    if (result.error === "bad_pin") {
      setFault("Wrong PIN. Money stayed.");
      setScreen({ name: "pin", quote, payWith, buffer: "" });
      return;
    }
    setScreen({ name: "note", body: "Not sent. Nothing was charged.\n\n0 Menu" });
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
        {renderScreen(screen, latest, corridor.balanceZarCents, Boolean(corridor.held))}
        {fault ? `\n${fault}` : ""}
        {corridor.busy ? "\n\nWorking… do not press again." : ""}
      </pre>
      <div className="grid grid-cols-3 gap-1.5 p-3">
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

function renderScreen(screen: Screen, latest: Order | undefined, balance: number, held: boolean) {
  if (screen.name === "menu") {
    return `Mukuru *130*567#\nCard ${zar(balance)}\n${held ? "\nHELD ORDER ON PHONE\n1 Finish the same order" : "\n1 Send home"}\n2 Last send\n3 Help`;
  }
  if (screen.name === "amount") {
    return `Send to Amai Rudo\n\n1 Same as Sep  R2000\n2 Other amount\n0 Back`;
  }
  if (screen.name === "custom") {
    return `Amount in rands\nR${screen.buffer || "0"}\n\nType, then OK\n0 Back`;
  }
  if (screen.name === "payout") {
    return `R${(screen.amount / 100).toFixed(0)} for Amai\n\n1 Her wallet\n2 Cash at booth\n0 Back`;
  }
  if (screen.name === "review") {
    const quote = screen.quote;
    return `Amai gets ${usd(quote.usdOutCents)}\nYou pay ${zar(quote.amountZarCents)}\nFee ${zar(quote.feeZarCents)}\n${quote.payout === "wallet" ? "Wallet" : "Booth cash"}\n\n1 Pay from card\n2 Pay at PEP\n0 Menu`;
  }
  if (screen.name === "pin") {
    return `Enter PIN\n${"•".repeat(screen.buffer.length)}${"-".repeat(4 - screen.buffer.length)}\nDemo 2580\n\nOK to send\n0 Menu`;
  }
  if (screen.name === "result") {
    const order = screen.order;
    const tail =
      order.status === "awaiting_payment"
        ? "Amai has no voucher\nuntil PEP is paid."
        : order.payout === "wallet"
          ? "In Amai's wallet."
          : "Booth voucher is ready.";
    return `SENT ${order.ref}\n${usd(order.usdOutCents)}\n${tail}\nCard ${zar(balance)}\n\n0 Menu`;
  }
  if (screen.name === "last" && latest) {
    return `Last send\n${latest.ref}\n${day(latest.createdAt)}\n${usd(latest.usdOutCents)}\n${latest.status.replaceAll("_", " ")}\n\n0 Menu`;
  }
  if (screen.name === "help") {
    return `Voucher + ID to collect.\nBooth collection is free.\nMukuru will not ask\nfor a PIN by phone.\n\n0 Menu`;
  }
  if (screen.name === "note") return screen.body;
  return `No send yet.\n\n0 Menu`;
}
