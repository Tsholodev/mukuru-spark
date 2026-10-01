"use client";

import type { PayWith, Quote } from "@/lib/engine";
import { rateLabel, usd, when, zar } from "@/lib/format";
import { Button } from "@/components/ui/button";

export function QuoteCard({
  quote,
  locked,
  busy,
  onLock,
  onPay,
}: {
  quote: Quote;
  locked: boolean;
  busy: boolean;
  onLock?: () => void;
  onPay?: (payWith: PayWith) => void;
}) {
  const lands = quote.payout === "wallet" ? "Her Mukuru Wallet" : "Cash at the Orange Booth, Borrowdale";

  return (
    <article className="rounded-3xl border border-[#F0E2D6] bg-white p-4 shadow-[0_8px_30px_rgba(80,40,10,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-[0.14em] text-[#9A7B68]">
          {locked ? "RATE LOCKED" : "ESTIMATE"}
        </p>
        <p className="text-xs text-[#9A7B68]">{quote.payout === "wallet" ? "Wallet" : "Booth cash"}</p>
      </div>
      <p className="mt-3 text-sm text-[#6D5E55]">Amai receives</p>
      <p className="mt-1 font-sans text-4xl font-semibold tracking-tight text-[#241910]" data-testid="quote-usd">
        {usd(quote.usdOutCents)}
      </p>
      <dl className="mt-4 space-y-2 text-[15px]">
        <Row label="Leaves your card" value={zar(quote.amountZarCents)} />
        <Row label="Mukuru fee, inside that" value={zar(quote.feeZarCents)} />
        <Row label="Changed into dollars" value={zar(quote.netZarCents)} />
        <Row label="Rate on this transfer" value={rateLabel(quote.rateMilli)} />
        <Row label="Screen rate today" value={rateLabel(quote.midMilli)} />
        <Row label="Same rands at screen rate" value={usd(quote.midUsdCents)} />
        <Row label="She pays to collect" value="R0.00" />
        <Row label="Lands in" value={lands} />
      </dl>
      <p className="mt-4 text-sm leading-relaxed text-[#6D5E55]">
        The gap between the two rates, plus the fee, is the whole price. Nothing else is taken in Harare.
        {locked ? ` Locked until ${when(quote.lockedUntil)}.` : " Not locked yet. The card has not been touched."}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-[#9A7B68]">
        Demo rate card, not a live Mukuru price. Collection at a Mukuru booth is free on this corridor.
      </p>
      {locked && onPay ? (
        <div className="mt-4 space-y-2">
          <Button className="w-full" disabled={busy} data-testid="pay-card" onClick={() => onPay("card")}>
            Pay from Mukuru Card
          </Button>
          <Button
            className="w-full"
            variant="secondary"
            disabled={busy}
            data-testid="pay-retail"
            onClick={() => onPay("retail")}
          >
            Pay cash at PEP instead
          </Button>
          <p className="text-center text-xs leading-relaxed text-[#9A7B68]">
            Card payment charges once. PEP payment does not tell Amai until the till confirms the cash.
          </p>
        </div>
      ) : (
        <Button className="mt-4 w-full" disabled={busy || !onLock} data-testid="lock-rate" onClick={onLock}>
          {busy ? "Locking the rate…" : "Lock this rate"}
        </Button>
      )}
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[#6D5E55]">{label}</dt>
      <dd className="text-right font-semibold tabular-nums text-[#241910]">{value}</dd>
    </div>
  );
}
