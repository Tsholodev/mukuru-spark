"use client";

import type { Order } from "@/lib/engine";
import { day, usd, zar } from "@/lib/format";
import { amai } from "@/lib/profile";
import { useCorridor } from "@/components/corridor-context";
import { PhoneShell } from "@/components/thandi-phone";
import { Button } from "@/components/ui/button";

export function AmaiPhone() {
  const corridor = useCorridor();
  const active = corridor.orders.find((order) => !order.idempotencyKey.startsWith("seed-"));
  const september = corridor.orders.find((order) => order.ref === "MUK-7H2K9");

  return (
    <PhoneShell eyebrow="AMAI · HARARE" tone="receive">
      <div className="border-b border-[#E4EEE6] bg-[#F4F8F5] px-4 pb-4 pt-10">
        <p className="text-xs font-semibold tracking-[0.14em] text-[#3E6B52]">MUKURU VOUCHER</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Mhoro, Amai.</h2>
        <p className="text-sm text-[#4E6558]">This phone only changes when the money is real.</p>
      </div>
      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto bg-[#F7FBF8] px-4 py-4">
        {corridor.loading ? (
          <p className="text-sm text-[#4E6558]">Looking for a voucher…</p>
        ) : active ? (
          <ActiveVoucher order={active} onCollect={() => void corridor.markCollected(active.ref)} busy={corridor.busy} />
        ) : (
          <div data-testid="amai-empty">
            <p className="text-2xl font-semibold tracking-tight">Nothing new for October.</p>
            <p className="mt-3 text-[15px] leading-relaxed text-[#3E5146]">
              A voucher shows up here only after Thandi&apos;s payment is real. A screenshot is not a payment.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-[#3E5146]">
              Nhamba yekutora inoonekwa chete kana mari yasvika. Screenshot haisi mari.
            </p>
            {september && (
              <div className="mt-5 rounded-3xl border border-[#D7E6DC] bg-white p-4">
                <p className="text-xs font-semibold tracking-[0.14em] text-[#3E6B52]">SEPTEMBER · CASHED OUT</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{usd(september.usdOutCents)}</p>
                <p className="mt-1 text-sm text-[#4E6558]">
                  {september.ref} · wallet · {day(september.collectedAt ?? september.createdAt)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </PhoneShell>
  );
}

function ActiveVoucher({
  order,
  onCollect,
  busy,
}: {
  order: Order;
  onCollect: () => void;
  busy: boolean;
}) {
  if (!order.voucherAt) {
    return (
      <div data-testid="amai-status">
        <p className="text-xs font-semibold tracking-[0.14em] text-[#8A5A00]">NOT A VOUCHER</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">Mukuru has not been paid.</p>
        <p className="mt-3 text-[15px] leading-relaxed">
          Thandi started an order. There is no collection number until the cash is confirmed. Do not hand anyone goods
          against a screenshot.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed">
          Hapana nhamba yekutora. Usapa chinhu ne screenshot.
        </p>
      </div>
    );
  }

  const settled = order.status === "collected" || order.status === "cashed_out";
  const wallet = order.payout === "wallet";

  return (
    <div data-testid="amai-status">
      <p className="text-xs font-semibold tracking-[0.14em] text-[#3E6B52]">
        {order.status === "in_wallet"
          ? "IN YOUR WALLET"
          : order.status === "ready"
            ? "READY TO COLLECT"
            : order.status === "cashed_out"
              ? "CASHED OUT"
              : "COLLECTED"}
      </p>
      <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">{usd(order.usdOutCents)}</p>
      <p className="mt-3 font-mono text-3xl font-medium tracking-wide">{order.ref}</p>
      <p className="mt-4 text-[15px] leading-relaxed">
        {wallet
          ? "This transfer is in your Mukuru Wallet. Taking the notes at an Orange Booth is free."
          : `Collect the notes at ${amai.booth}. Bring the ID that says ${amai.name}.`}
      </p>
      <p className="mt-3 text-[15px] leading-relaxed">
        {wallet
          ? "Mari iri muWallet. Kubuda kwemari pabooth hakubhadharwi."
          : "Uya neID inoti Rudo Ncube. Kutora hakubhadharwi."}
      </p>
      <p className="mt-3 text-[15px] leading-relaxed">
        Mukuru will not phone you to ask for a PIN, a card number, or this voucher.
      </p>
      <p className="mt-1 text-sm text-[#4E6558]">Mukuru haikumbiri PIN panhare.</p>
      <p className="mt-4 text-sm text-[#4E6558]">
        {order.payWith === "card"
          ? `From Thandi · ${zar(order.amountZarCents)} left her card.`
          : "From Thandi · paid in cash at PEP. The card was not used."}{" "}
        ID on file {amai.idMasked}.
      </p>
      {!settled && (
        <Button className="mt-4 w-full" variant="dark" disabled={busy} data-testid="amai-collect" onClick={onCollect}>
          {wallet ? "I cashed out the notes" : "I have the cash"}
        </Button>
      )}
    </div>
  );
}
