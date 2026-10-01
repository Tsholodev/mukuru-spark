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
    <article
      data-testid="quote-card"
      className="rounded-3xl border border-[#F0E2D6] bg-white px-4 py-3 shadow-[0_8px_30px_rgba(80,40,10,0.04)]"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-[0.14em] text-[#9A7B68]">
          {locked ? "RATE LOCKED" : "ESTIMATE"}
        </p>
        <p className="text-xs text-[#9A7B68]">{quote.payout === "wallet" ? "Wallet" : "Booth cash"}</p>
      </div>
      <p className="mt-2 text-sm text-[#6D5E55]">Amai receives</p>
      <p className="font-sans text-[2rem] font-semibold leading-none tracking-tight text-[#241910]" data-testid="quote-usd">
        {usd(quote.usdOutCents)}
      </p>
      <dl className="mt-2 space-y-0.5 text-sm">
        <Row label="Leaves your card" value={zar(quote.amountZarCents)} />
        <Row label="Mukuru fee, inside that" value={zar(quote.feeZarCents)} />
        <Row label="Rate on this transfer" value={rateLabel(quote.rateMilli)} />
        <Row label="Screen rate today" value={rateLabel(quote.midMilli)} />
        <Row label="She pays to collect" value="R0.00" />
        <Row label="Lands in" value={lands} />
      </dl>
      <p className="mt-1.5 text-xs leading-snug text-[#6D5E55]">
        Screen rate would pay about {usd(quote.midUsdCents)}.
        {locked ? ` Locked until ${when(quote.lockedUntil)}.` : " Not locked yet."}
      </p>
      {(onLock || onPay) && (
        <div className="mt-3 space-y-2">
          {locked && onPay ? (
            <>
              <Button className="w-full" disabled={busy} data-testid="pay-card" onClick={() => onPay("card")}>
                Pay from Mukuru Card
              </Button>
              <Button className="w-full" variant="secondary" disabled={busy} data-testid="pay-retail" onClick={() => onPay("retail")}>
                Pay cash at PEP instead
              </Button>
            </>
          ) : (
            <Button className="w-full" disabled={busy || !onLock} data-testid="lock-rate" onClick={onLock}>
              {busy ? "Locking the rate…" : "Lock this rate"}
            </Button>
          )}
        </div>
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
