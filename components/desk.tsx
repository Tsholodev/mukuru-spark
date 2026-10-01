"use client";

import Link from "next/link";
import { t } from "@/lib/copy";
import { CorridorProvider, useCorridor } from "@/components/corridor-context";
import { ThandiPhone } from "@/components/thandi-phone";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Desk() {
  return (
    <CorridorProvider>
      <DeskFrame />
    </CorridorProvider>
  );
}

function DeskFrame() {
  const corridor = useCorridor();
  const awaiting = corridor.orders.find((order) => order.status === "awaiting_payment");

  return (
    <div className="glass-page flex h-dvh flex-col overflow-hidden">
      <header className="mx-auto flex w-full max-w-6xl shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[#E7Cbb8]">MUKURU HOME · SHEHACKS</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Johannesburg to Harare.</h1>
          <p className="text-sm text-[#E7Cbb8]">Demo PIN 2580. The orange button sends the money.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-white/10 p-1">
            <button
              type="button"
              data-testid="lang-en"
              className={cn(
                "h-10 rounded-full px-3 text-sm font-semibold",
                corridor.lang === "en" ? "bg-white text-[#241910]" : "text-[#E7Cbb8]",
              )}
              onClick={() => corridor.setLang("en")}
            >
              English
            </button>
            <button
              type="button"
              data-testid="lang-sn"
              className={cn(
                "h-10 rounded-full px-3 text-sm font-semibold",
                corridor.lang === "sn" ? "bg-white text-[#241910]" : "text-[#E7Cbb8]",
              )}
              onClick={() => corridor.setLang("sn")}
            >
              ChiShona
            </button>
          </div>
          <button
            type="button"
            data-testid="icon-mode"
            aria-pressed={corridor.icons}
            className={cn(
              "h-10 rounded-full px-4 text-sm font-semibold",
              corridor.icons ? "bg-white text-[#241910]" : "bg-white/10 text-[#E7Cbb8]",
            )}
            onClick={() => corridor.setIcons(!corridor.icons)}
          >
            {corridor.icons ? "Icons" : "Words"}
          </button>
          <Button variant="secondary" asChild>
            <Link href="/pitch">Panel notes</Link>
          </Button>
          <Button variant="secondary" data-testid="reset-demo" onClick={() => void corridor.resetDemo()}>
            Reset payday
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              void fetch("/api/auth/logout", { method: "POST" }).then(() => {
                window.location.href = "/";
              });
            }}
          >
            Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl shrink-0 px-4 pb-2">
        <button
          type="button"
          data-testid="send-home"
          disabled={corridor.busy}
          className="h-12 w-full rounded-full bg-[#E65300] text-base font-semibold text-white disabled:opacity-40"
          onClick={() => void corridor.requestQuote(200_000, "wallet")}
        >
          {t(corridor.lang, "sameSeptember")}
        </button>
      </div>

      <main className="mx-auto grid min-h-0 w-full max-w-md flex-1 items-stretch px-4 pb-3">
        <div className="h-full min-h-0">
          <ThandiPhone />
          {awaiting && (
            <div className="mx-auto mt-3 max-w-[420px] rounded-2xl border border-dashed border-[#E7Cbb8]/50 px-4 py-3">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-[#E7Cbb8]">PANEL CONTROL</p>
              <p className="mt-1 text-sm leading-relaxed text-[#F6EDE6]">
                {awaiting.ref} is waiting for cash at PEP. Amai still has no voucher.
              </p>
              <Button className="mt-3" data-testid="pep-confirm" onClick={() => void corridor.markPaid(awaiting.ref)}>
                Mark the PEP cash as received
              </Button>
            </div>
          )}
        </div>
      </main>
      <p className="sr-only" aria-live="polite">
        {corridor.notice ? t(corridor.lang, corridor.notice) : ""}
      </p>
      <footer className="shrink-0 px-4 pb-2 text-center text-[11px] leading-relaxed text-[#B7A297]">
        Student prototype, not the real Mukuru app. This demo dials *120#. Mukuru&apos;s live code is *130*567#.
      </footer>
    </div>
  );
}
