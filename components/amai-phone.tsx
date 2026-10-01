"use client";

import type { Order } from "@/lib/engine";
import { t } from "@/lib/copy";
import { day, usd, zar } from "@/lib/format";
import { amai } from "@/lib/profile";
import { useCorridor } from "@/components/corridor-context";
import { StatusTrack } from "@/components/status-track";
import { PhoneShell } from "@/components/thandi-phone";
import { Button } from "@/components/ui/button";

export function AmaiPhone() {
  const corridor = useCorridor();
  const lang = corridor.lang;
  const active = corridor.orders.find((order) => !order.idempotencyKey.startsWith("seed-"));
  const september = corridor.orders.find((order) => order.ref === "MUK-7H2K9");

  return (
    <PhoneShell eyebrow="AMAI · HARARE" tone="receive">
      <div className="border-b border-[#E4EEE6] bg-[#F4F8F5] px-4 pb-4 pt-10">
        <p className="text-xs font-semibold tracking-[0.14em] text-[#3E6B52]">{t(lang, "voucherLabel")}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{t(lang, "mhoroAmai")}</h2>
        <p className="text-sm text-[#4E6558]">{t(lang, "phoneChanges")}</p>
      </div>
      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto bg-[#F7FBF8] px-4 py-4">
        {corridor.loading ? (
          <p className="text-sm text-[#4E6558]">{t(lang, "looking")}</p>
        ) : active ? (
          <ActiveVoucher order={active} onCollect={() => void corridor.markCollected(active.ref)} busy={corridor.busy} />
        ) : (
          <div data-testid="amai-empty">
            <p className="text-2xl font-semibold tracking-tight">{t(lang, "nothingNew")}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-[#3E5146]">{t(lang, "screenshot")}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-[#3E5146]">{t(lang, "screenshotSn")}</p>
            {september && (
              <div className="mt-5 rounded-3xl border border-[#D7E6DC] bg-white p-4">
                <p className="text-xs font-semibold tracking-[0.14em] text-[#3E6B52]">{t(lang, "september")}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{usd(september.usdOutCents)}</p>
                <p className="mt-1 text-sm text-[#4E6558]">
                  {september.ref} · {t(lang, "herWallet")} · {day(september.collectedAt ?? september.createdAt)}
                </p>
                <div className="mt-3">
                  <StatusTrack status="collected" lang={lang} icons={corridor.icons} />
                </div>
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
  const { lang, icons } = useCorridor();

  if (order.status === "awaiting_payment" || !order.paidAt) {
    return (
      <div data-testid="amai-status">
        <p className="text-xs font-semibold tracking-[0.14em] text-[#8A5A00]">{t(lang, "waitingPay")}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{t(lang, "notPaidTitle")}</p>
        <p className="mt-3 text-[15px] leading-relaxed">{t(lang, "notPaidBody")}</p>
        <p className="mt-3 text-[15px] leading-relaxed">{t(lang, "screenshot")}</p>
        <p className="mt-3 text-[15px] leading-relaxed">{t(lang, "screenshotSn")}</p>
      </div>
    );
  }

  if (order.status === "sent" || order.status === "in_transit") {
    return (
      <div data-testid="amai-status">
        <p className="text-xs font-semibold tracking-[0.14em] text-[#8A5A00]">{t(lang, "movingTitle")}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{usd(order.usdOutCents)}</p>
        <div className="mt-4">
          <StatusTrack status={order.status} lang={lang} icons={icons} />
        </div>
        <p className="mt-4 text-[15px] leading-relaxed">{t(lang, "onTheWay")}</p>
        <p className="mt-3 text-[15px] leading-relaxed">{t(lang, "notReadyYet")}</p>
      </div>
    );
  }

  const ready = order.status === "ready";
  const wallet = order.payout === "wallet";

  return (
    <div data-testid="amai-status">
      <p className="text-xs font-semibold tracking-[0.14em] text-[#3E6B52]">
        {ready ? t(lang, "ready") : t(lang, "collected")}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight" data-testid="ready-notice">
        {ready ? t(lang, "readyNotice") : t(lang, "collected")}
      </p>
      <p className="mt-2 text-[15px] leading-relaxed">{ready ? t(lang, "readyNoticeSn") : t(lang, "collected")}</p>
      <div className="mt-4">
        <StatusTrack status={order.status} lang={lang} icons={icons} />
      </div>
      <p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">{usd(order.usdOutCents)}</p>
      <p className="mt-3 font-mono text-3xl font-medium tracking-wide">{order.ref}</p>
      <p className="mt-4 text-[15px] leading-relaxed">
        {wallet ? t(lang, "freeCashout") : `${t(lang, "bringId")} ${amai.booth}.`}
      </p>
      <p className="mt-3 text-[15px] leading-relaxed">{wallet ? t(lang, "walletSn") : t(lang, "bringIdSn")}</p>
      <p className="mt-3 text-[15px] leading-relaxed">{t(lang, "noPin")}</p>
      <p className="mt-1 text-sm text-[#4E6558]">{t(lang, "noPinSn")}</p>
      <p className="mt-4 text-sm text-[#4E6558]">
        {order.payWith === "card"
          ? t(lang, "fromThandiCard", { amount: zar(order.amountZarCents) })
          : t(lang, "fromThandiPep")}{" "}
        {t(lang, "idOnFile", { id: amai.idMasked })}
      </p>
      {ready && (
        <Button className="mt-4 w-full" variant="dark" disabled={busy} data-testid="amai-collect" onClick={onCollect}>
          {icons ? `✓  ${t(lang, "collectedBtn")}` : t(lang, "collectedBtn")}
        </Button>
      )}
    </div>
  );
}
