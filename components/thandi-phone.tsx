"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buildQuote, usdCentsFromNet, type PayWith, type Payout } from "@/lib/engine";
import { t } from "@/lib/copy";
import { day, parseRands, rateLabel, usd, zar } from "@/lib/format";
import { voucherMessage } from "@/lib/message";
import { thandi } from "@/lib/profile";
import { useCorridor, type Signal } from "@/components/corridor-context";
import { PinSheet } from "@/components/pin-sheet";
import { QuoteCard } from "@/components/quote-card";
import { StatusTrack } from "@/components/status-track";
import { UssdScreen } from "@/components/ussd-screen";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRESETS = [50_000, 100_000, 200_000, 350_000];

export function ThandiPhone() {
  const corridor = useCorridor();
  const lang = corridor.lang;
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
    const quote = node.querySelector("[data-testid='quote-card']");
    if (quote instanceof HTMLElement) {
      const delta = quote.getBoundingClientRect().top - node.getBoundingClientRect().top;
      node.scrollTop += delta - 8;
    } else {
      node.scrollTop = node.scrollHeight;
    }
  }, [said.length, step, corridor.openQuote?.id, corridor.held, corridor.notice, sessionCount, corridor.busy]);
  const history = corridor.orders.filter((order) => order.idempotencyKey.startsWith("seed-"));
  const sessionOrders = corridor.orders.filter((order) => !order.idempotencyKey.startsWith("seed-"));
  const customCents = custom.trim() ? parseRands(custom) : null;
  const draftCents = custom.trim() ? customCents : preset;
  const preview = useMemo(() => {
    if (!draftCents) return null;
    const built = buildQuote(draftCents, payout, Date.now(), "preview");
    if (!built.ok) return null;
    if (!corridor.fx) return built.quote;
    return {
      ...built.quote,
      rateMilli: corridor.fx.rateMilli,
      midMilli: corridor.fx.midMilli,
      usdOutCents: usdCentsFromNet(built.quote.netZarCents, corridor.fx.rateMilli),
      midUsdCents: usdCentsFromNet(built.quote.netZarCents, corridor.fx.midMilli),
    };
  }, [draftCents, payout, corridor.fx]);

  function openPin(payWith: PayWith) {
    setPinPay(payWith);
    setPinOpen(true);
  }

  async function sameAsSeptember() {
    setSaid((items) => [...items, t(lang, "saidSame")]);
    setStep("choose");
    await corridor.requestQuote(200_000, "wallet");
  }

  async function lockDraft() {
    if (!draftCents || !preview) return;
    setSaid((items) => [
      ...items,
      t(lang, "saidAmount", {
        amount: zar(draftCents),
        where: t(lang, payout === "wallet" ? "whereWallet" : "whereBooth"),
      }),
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
            <p className="text-sm text-[#6D5E55]">{t(lang, "everyMonth")}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[#9A7B68]">CARD ••{thandi.cardLast4}</p>
            <p className="text-lg font-semibold tabular-nums" data-testid="balance">
              {corridor.loading ? "…" : zar(corridor.balanceZarCents)}
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <p className="text-sm text-[#6D5E55]">{t(lang, "paydayLine")}</p>
          {corridor.fx && (
            <p className="text-xs font-semibold tabular-nums text-[#241910]" data-testid="live-rate">
              {t(lang, "liveRate")} {rateLabel(corridor.fx.rateMilli)}
            </p>
          )}
        </div>
      </div>

      {corridor.surface === "ussd" ? (
        <UssdScreen />
      ) : (
        <>
          <div ref={chatRef} className="chat-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {corridor.notice && (
              <p className="rounded-2xl bg-[#FFF4D8] px-4 py-3 text-sm leading-relaxed text-[#6A4B12]" data-testid="notice">
                {t(lang, corridor.notice)}
              </p>
            )}
            <Bubble>
              {september
                ? t(lang, "intro", { date: day(september.createdAt), usd: usd(september.usdOutCents) })
                : t(lang, "introEmpty")}
            </Bubble>
            {history.length > 0 && (
              <details className="rounded-2xl bg-white/70 px-4 py-3 text-sm text-[#6D5E55]">
                <summary className="cursor-pointer font-semibold text-[#241910]">{t(lang, "earlier")}</summary>
                <ul className="mt-3 space-y-2">
                  {history.map((order) => (
                    <li key={order.ref} className="flex justify-between gap-3 tabular-nums">
                      <span>
                        {day(order.createdAt)} · {order.ref}
                      </span>
                      <span>
                        {usd(order.usdOutCents)} · {t(lang, "collected")}
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
            {step === "amount" && preview && <QuoteCard quote={preview} locked={false} busy={corridor.busy} />}
            {step === "amount" && custom.trim() && !preview && (
              <p className="text-sm text-[#9F2D20]">{t(lang, "amountError")}</p>
            )}
            {payableQuote && step !== "amount" && (
              <>
                <QuoteCard quote={payableQuote} locked busy={corridor.busy} />
                {corridor.fx && corridor.fx.rateMilli !== payableQuote.rateMilli && (
                  <p className="text-xs leading-snug text-[#6A4B12]" data-testid="rate-moved">
                    {t(lang, "rateMoved")}
                  </p>
                )}
              </>
            )}
            {corridor.held && (
              <article className="rounded-3xl border border-[#E7C27A] bg-[#FFF8E8] p-4" data-testid="held-card">
                <p className="text-xs font-semibold tracking-[0.14em] text-[#8A5A00]">{t(lang, "heldKicker")}</p>
                <p className="mt-2 text-lg font-semibold">{t(lang, "heldTitle")}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#6A4B12]">
                  {t(lang, "heldBody")}
                  {corridor.held.payWith === "retail"
                    ? ""
                    : ` ${zar(corridor.held.quote.amountZarCents)} · ${usd(corridor.held.quote.usdOutCents)}.`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    disabled={corridor.busy}
                    data-testid="resume-held"
                    onClick={() => openPin(corridor.held?.payWith ?? "card")}
                  >
                    {corridor.busy ? t(lang, "stillSending") : t(lang, "resume")}
                  </Button>
                  <Button variant="secondary" disabled={corridor.busy} onClick={() => void corridor.releaseHeld()}>
                    {t(lang, "leaveUnsent")}
                  </Button>
                </div>
              </article>
            )}
            {sessionOrders.map((order) => (
              <article key={order.ref} className="rounded-3xl bg-[#E65300] p-4 text-white" data-testid="receipt">
                <p className="text-xs font-semibold tracking-[0.14em] text-white/80">
                  {order.status === "awaiting_payment" ? t(lang, "receiptWaiting") : t(lang, "receiptSent")}
                </p>
                <p className="mt-2 font-mono text-2xl font-medium tracking-wide">{order.ref}</p>
                <p className="mt-2 text-lg font-semibold">{t(lang, "forAmai", { usd: usd(order.usdOutCents) })}</p>
                {order.status !== "awaiting_payment" && (
                  <div className="mt-3 rounded-2xl bg-white px-2 py-3 text-[#241910]">
                    <StatusTrack status={order.status} lang={lang} icons={corridor.icons} />
                  </div>
                )}
                <p className="mt-2 text-sm leading-relaxed text-white/90">
                  {order.status === "awaiting_payment"
                    ? t(lang, "pepNote")
                    : order.status === "ready"
                      ? t(lang, "readyNotice")
                      : order.status === "collected"
                        ? t(lang, "collected")
                        : t(lang, "onTheWay")}
                </p>
                {order.status === "ready" || order.status === "collected" ? (
                  <p className="mt-1 text-sm leading-relaxed text-white/90">
                    {order.payout === "wallet" ? t(lang, "inWalletNote") : t(lang, "cashNote")}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-white/80">
                  {order.payWith === "card"
                    ? t(lang, "cardCharged", { amount: zar(order.amountZarCents) })
                    : t(lang, "cardNotCharged")}
                </p>
                {order.voucherAt && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => void copyMessage(order.ref, voucherMessage(order))}
                    >
                      {copied === order.ref ? t(lang, "copied") : t(lang, "copyWhatsapp")}
                    </Button>
                    <Button variant="secondary" asChild>
                      <a href={`/v/${order.ref}`} target="_blank" rel="noreferrer">
                        {t(lang, "amaiPage")}
                      </a>
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="border-t border-[#F0E2D6] bg-[#FFF9F4] p-3">
            {step === "choose" && !corridor.held && payableQuote && (
              <div className="grid gap-2">
                <Button data-testid="pay-card" disabled={corridor.busy} size={corridor.icons ? "lg" : "default"} onClick={() => openPin("card")}>
                  {corridor.icons ? "▣  " : ""}
                  {t(lang, "payCard", { amount: zar(payableQuote.amountZarCents) })}
                </Button>
                <Button
                  variant="secondary"
                  data-testid="pay-retail"
                  disabled={corridor.busy}
                  size={corridor.icons ? "lg" : "default"}
                  onClick={() => openPin("retail")}
                >
                  {corridor.icons ? "⌂  " : ""}
                  {t(lang, "payPep")}
                </Button>
                <p className="text-center text-xs leading-relaxed text-[#9A7B68]">{t(lang, "payHint")}</p>
              </div>
            )}
            {step === "choose" && !corridor.held && !payableQuote && (
              <div className="grid gap-2">
                <Button data-testid="same-september" disabled={corridor.busy} size={corridor.icons ? "lg" : "default"} onClick={() => void sameAsSeptember()}>
                  {corridor.icons ? "↻  " : ""}
                  {t(lang, "sameSeptember")}
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
                    {corridor.icons ? "✎  " : ""}
                    {t(lang, "differentAmount")}
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
                    {corridor.icons ? "⌂  " : ""}
                    {t(lang, "cashBooth")}
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
                  {t(lang, "typeAmount")}
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
                    {t(lang, "herWallet")}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "h-10 rounded-full text-sm font-semibold",
                      payout === "cash" ? "bg-[#241910] text-white" : "bg-white",
                    )}
                    onClick={() => setPayout("cash")}
                  >
                    {t(lang, "boothCash")}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="ghost" onClick={() => setStep("choose")}>
                    {t(lang, "back")}
                  </Button>
                  <Button data-testid="lock-rate" disabled={corridor.busy || !preview} onClick={() => void lockDraft()}>
                    {corridor.busy ? t(lang, "locking") : t(lang, "lockRate")}
                  </Button>
                </div>
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
          {t(lang, "thisAndroid")}
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
          {t(lang, "ussd")}
        </button>
      </div>
      <PinSheet
        open={pinOpen}
        busy={corridor.busy}
        title={t(lang, pinPay === "card" ? "pinTitle" : "pinPep")}
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
