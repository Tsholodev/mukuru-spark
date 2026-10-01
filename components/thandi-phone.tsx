"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buildQuote, type PayWith, type Payout } from "@/lib/engine";
import { day, parseRands, usd, zar } from "@/lib/format";
import { voucherMessage } from "@/lib/message";
import { thandi } from "@/lib/profile";
import { useCorridor, type Signal } from "@/components/corridor-context";
import { PinSheet } from "@/components/pin-sheet";
import { QuoteCard } from "@/components/quote-card";
import { UssdScreen } from "@/components/ussd-screen";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRESETS = [50_000, 100_000, 200_000, 350_000];

export function ThandiPhone() {
  const corridor = useCorridor();
  const [step, setStep] = useState<"choose" | "amount">("choose");
  const [payout, setPayout] = useState<Payout>("wallet");
  const [preset, setPreset] = useState(200_000);
  const [custom, setCustom] = useState("");
  const [said, setSaid] = useState<string[]>([]);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinPay, setPinPay] = useState<PayWith>("card");
  const [copied, setCopied] = useState<string | null>(null);
  const [clock, setClock] = useState("09:41");
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStep("choose");
    setSaid([]);
    setCustom("");
    setPinOpen(false);
    setPreset(200_000);
    setPayout("wallet");
  }, [corridor.demoId]);

  useEffect(() => {
    const format = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Africa/Johannesburg",
    });
    const tick = () => setClock(format.format(new Date()));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  const september = corridor.orders.find((order) => order.ref === "MUK-7H2K9");
  const sessionCount = corridor.orders.filter((order) => !order.idempotencyKey.startsWith("seed-")).length;

  useEffect(() => {
    const node = chatRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight });
  }, [said.length, step, corridor.openQuote?.id, corridor.held, corridor.notice, sessionCount, corridor.busy]);
  const history = corridor.orders.filter((order) => order.idempotencyKey.startsWith("seed-"));
  const sessionOrders = corridor.orders.filter((order) => !order.idempotencyKey.startsWith("seed-"));
  const customCents = custom.trim() ? parseRands(custom) : null;
  const draftCents = custom.trim() ? customCents : preset;
  const preview = useMemo(() => {
    if (!draftCents) return null;
    const built = buildQuote(draftCents, payout, Date.now(), "preview");
    return built.ok ? built.quote : null;
  }, [draftCents, payout]);

  function openPin(payWith: PayWith) {
    setPinPay(payWith);
    setPinOpen(true);
  }

  async function sameAsSeptember() {
    setSaid((items) => [...items, "Same as September. R2 000 to her wallet."]);
    setStep("choose");
    await corridor.requestQuote(200_000, "wallet");
  }

  async function lockDraft() {
    if (!draftCents || !preview) return;
    setSaid((items) => [
      ...items,
      `${zar(draftCents)} to ${payout === "wallet" ? "her wallet" : "a booth"}.`,
    ]);
    const quote = await corridor.requestQuote(draftCents, payout);
    if (quote) setStep("choose");
  }

  async function submitPin(pin: string) {
    const quote = corridor.held?.quote ?? corridor.openQuote;
    if (!quote) return;
    const result = await corridor.submitOrder(quote, pin, corridor.held?.payWith ?? pinPay);
    if (result.ok || result.error !== "bad_pin") setPinOpen(false);
  }

  async function copyMessage(ref: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(ref);
    } catch {
      setCopied(null);
    }
  }

  const payableQuote = corridor.held ? null : corridor.openQuote;

  return (
    <PhoneShell
      eyebrow="THANDI · JOHANNESBURG"
      clock={clock}
      signal={corridor.signal}
      onSignal={corridor.setSignal}
    >
      <div className="border-b border-[#F0E2D6] px-4 pb-3 pt-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Amai Rudo</h2>
            <p className="text-sm text-[#6D5E55]">Harare · mother · every month</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[#9A7B68]">CARD ••{thandi.cardLast4}</p>
            <p className="text-lg font-semibold tabular-nums" data-testid="balance">
              {corridor.loading ? "…" : zar(corridor.balanceZarCents)}
            </p>
          </div>
        </div>
        <p className="mt-2 text-sm text-[#6D5E55]">Payday is on the card. You do not need to phone anyone.</p>
      </div>

      {corridor.surface === "ussd" ? (
        <UssdScreen />
      ) : (
        <>
          <div ref={chatRef} className="chat-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {corridor.notice && (
              <p className="rounded-2xl bg-[#FFF4D8] px-4 py-3 text-sm leading-relaxed text-[#6A4B12]" data-testid="notice">
                {corridor.notice}
              </p>
            )}
            <Bubble>
              {september ? (
                <>
                  Mhoro, Thandi. Payday. September reached Amai on {day(september.createdAt)}. She got{" "}
                  {usd(september.usdOutCents)} in her wallet, and she has already cashed it out. Send October the same
                  way?
                </>
              ) : (
                "Mhoro, Thandi. Send money home when you are ready."
              )}
            </Bubble>
            {history.length > 0 && (
              <details className="rounded-2xl bg-white/70 px-4 py-3 text-sm text-[#6D5E55]">
                <summary className="cursor-pointer font-semibold text-[#241910]">Earlier sends</summary>
                <ul className="mt-3 space-y-2">
                  {history.map((order) => (
                    <li key={order.ref} className="flex justify-between gap-3 tabular-nums">
                      <span>
                        {day(order.createdAt)} · {order.ref}
                      </span>
                      <span>
                        {usd(order.usdOutCents)} · {order.status === "cashed_out" ? "cashed out" : "collected"}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {said.map((line, index) => (
              <Bubble key={`${line}-${index}`} mine>
                {line}
              </Bubble>
            ))}
            {step === "amount" && preview && (
              <QuoteCard quote={preview} locked={false} busy={corridor.busy} onLock={() => void lockDraft()} />
            )}
            {step === "amount" && custom.trim() && !preview && (
              <p className="text-sm text-[#9F2D20]">Use an amount from R100 to R5 000, like 1500 or 1500.50.</p>
            )}
            {payableQuote && step !== "amount" && (
              <QuoteCard
                quote={payableQuote}
                locked
                busy={corridor.busy}
                onPay={(payWith) => openPin(payWith)}
              />
            )}
            {corridor.held && (
              <article className="rounded-3xl border border-[#E7C27A] bg-[#FFF8E8] p-4" data-testid="held-card">
                <p className="text-xs font-semibold tracking-[0.14em] text-[#8A5A00]">HELD ON THIS PHONE</p>
                <p className="mt-2 text-lg font-semibold">Your money has not left the card.</p>
                <p className="mt-2 text-sm leading-relaxed text-[#6A4B12]">
                  Amai has not been told. When the signal is back, this same order is sent. It is not a second charge.
                  {corridor.held.payWith === "retail" ? " This one waits for PEP." : ` ${zar(corridor.held.quote.amountZarCents)} to Amai, ${usd(corridor.held.quote.usdOutCents)}.`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    disabled={corridor.busy}
                    data-testid="resume-held"
                    onClick={() => openPin(corridor.held?.payWith ?? "card")}
                  >
                    {corridor.busy ? "Still sending…" : "Type PIN for this same order"}
                  </Button>
                  <Button variant="secondary" disabled={corridor.busy} onClick={() => void corridor.releaseHeld()}>
                    Leave it unsent
                  </Button>
                </div>
              </article>
            )}
            {sessionOrders.map((order) => (
              <article key={order.ref} className="rounded-3xl bg-[#E65300] p-4 text-white" data-testid="receipt">
                <p className="text-xs font-semibold tracking-[0.14em] text-white/80">
                  {order.status === "awaiting_payment" ? "WAITING FOR PEP" : "SENT"}
                </p>
                <p className="mt-2 font-mono text-2xl font-medium tracking-wide">{order.ref}</p>
                <p className="mt-2 text-lg font-semibold">{usd(order.usdOutCents)} for Amai</p>
                <p className="mt-1 text-sm leading-relaxed text-white/90">
                  {order.status === "awaiting_payment"
                    ? "Pay this number at PEP. Amai has no voucher until the cash is confirmed."
                    : order.payout === "wallet"
                      ? "The money is in her Mukuru Wallet. Cash-out at a booth is free on this transfer."
                      : "She can collect the notes. She needs her ID and this number."}
                </p>
                <p className="mt-2 text-sm text-white/80">
                  {order.payWith === "card"
                    ? `Card charged ${zar(order.amountZarCents)}.`
                    : "The card was not charged. PEP takes the cash."}
                </p>
                {order.voucherAt && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => void copyMessage(order.ref, voucherMessage(order))}
                    >
                      {copied === order.ref ? "Copied" : "Copy WhatsApp"}
                    </Button>
                    <Button variant="secondary" asChild>
                      <a href={`/v/${order.ref}`} target="_blank" rel="noreferrer">
                        Amai&apos;s page
                      </a>
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="border-t border-[#F0E2D6] bg-[#FFF9F4] p-3">
            {step === "choose" && !corridor.held && (
              <div className="grid gap-2">
                <Button data-testid="same-september" disabled={corridor.busy} onClick={() => void sameAsSeptember()}>
                  Same as September · R2 000
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    disabled={corridor.busy}
                    onClick={() => {
                      setPayout("wallet");
                      setStep("amount");
                    }}
                  >
                    Different amount
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={corridor.busy}
                    data-testid="choose-cash"
                    onClick={() => {
                      setPayout("cash");
                      setStep("amount");
                    }}
                  >
                    Cash at a booth
                  </Button>
                </div>
              </div>
            )}
            {step === "amount" && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {PRESETS.map((cents) => (
                    <button
                      key={cents}
                      type="button"
                      className={cn(
                        "h-10 rounded-full text-sm font-semibold",
                        preset === cents && !custom.trim() ? "bg-[#241910] text-white" : "bg-white text-[#241910]",
                      )}
                      onClick={() => {
                        setPreset(cents);
                        setCustom("");
                      }}
                    >
                      {zar(cents).replace(".00", "")}
                    </button>
                  ))}
                </div>
                <label className="block text-sm text-[#6D5E55]">
                  Or type an amount
                  <input
                    inputMode="decimal"
                    value={custom}
                    onChange={(event) => setCustom(event.target.value)}
                    placeholder="1500"
                    className="mt-1 h-12 w-full rounded-2xl border border-[#E7D9CE] bg-white px-4 text-lg text-[#241910] outline-none focus:border-[#E65300]"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={cn(
                      "h-10 rounded-full text-sm font-semibold",
                      payout === "wallet" ? "bg-[#241910] text-white" : "bg-white",
                    )}
                    onClick={() => setPayout("wallet")}
                  >
                    Her wallet
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "h-10 rounded-full text-sm font-semibold",
                      payout === "cash" ? "bg-[#241910] text-white" : "bg-white",
                    )}
                    onClick={() => setPayout("cash")}
                  >
                    Booth cash
                  </button>
                </div>
                <Button variant="ghost" onClick={() => setStep("choose")}>
                  Back
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2 border-t border-[#F0E2D6] bg-[#FFF9F4] p-3">
        <button
          type="button"
          data-testid="surface-android"
          className={cn(
            "h-10 rounded-full text-sm font-semibold",
            corridor.surface === "android" ? "bg-[#241910] text-white" : "bg-[#F3E8DF] text-[#241910]",
          )}
          onClick={() => corridor.setSurface("android")}
        >
          This Android
        </button>
        <button
          type="button"
          data-testid="surface-ussd"
          className={cn(
            "h-10 rounded-full text-sm font-semibold",
            corridor.surface === "ussd" ? "bg-[#241910] text-white" : "bg-[#F3E8DF] text-[#241910]",
          )}
          onClick={() => corridor.setSurface("ussd")}
        >
          USSD *130*567#
        </button>
      </div>
      <PinSheet
        open={pinOpen}
        busy={corridor.busy}
        title={pinPay === "card" ? "Mukuru Card PIN" : "PIN to start the PEP order"}
        onClose={() => setPinOpen(false)}
        onSubmit={(pin) => void submitPin(pin)}
      />
    </PhoneShell>
  );
}

export function PhoneShell({
  eyebrow,
  clock,
  signal,
  onSignal,
  tone = "send",
  children,
}: {
  eyebrow: string;
  clock?: string;
  signal?: Signal;
  onSignal?: (signal: Signal) => void;
  tone?: "send" | "receive";
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[420px]">
      <p className="mb-2 px-2 text-[11px] font-semibold tracking-[0.16em] text-[#E7Cbb8]">{eyebrow}</p>
      <div className="rounded-[2rem] bg-[#100E0C] p-2 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div
          className={cn(
            "relative flex h-[740px] max-h-[calc(100dvh-8.5rem)] flex-col overflow-hidden rounded-[1.55rem] text-[#241910]",
            tone === "receive" ? "bg-[#F7FBF8]" : "bg-[#FFF9F4]",
          )}
        >
          <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[#100E0C]" />
          {clock && signal && onSignal && (
            <div className="flex items-center justify-between px-4 pb-1 pt-8">
              <span className="text-xs font-semibold tabular-nums">{clock}</span>
              <SignalControl signal={signal} onChange={onSignal} />
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

function SignalControl({ signal, onChange }: { signal: Signal; onChange: (signal: Signal) => void }) {
  const options: { id: Signal; label: string }[] = [
    { id: "good", label: "Full" },
    { id: "weak", label: "1 bar" },
    { id: "off", label: "None" },
  ];
  return (
    <div role="radiogroup" aria-label="Thandi's signal" className="flex rounded-full bg-[#F3E8DF] p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={signal === option.id}
          data-testid={`signal-${option.id}`}
          onClick={() => onChange(option.id)}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            signal === option.id ? "bg-[#241910] text-white" : "text-[#6D5E55]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Bubble({ children, mine = false }: { children: ReactNode; mine?: boolean }) {
  return (
    <p
      className={cn(
        "max-w-[95%] rounded-3xl px-4 py-3 text-[15px] leading-relaxed",
        mine ? "ml-auto rounded-br-md bg-[#241910] text-white" : "rounded-bl-md bg-white text-[#241910]",
      )}
    >
      {children}
    </p>
  );
}
