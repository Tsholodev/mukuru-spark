"use client";

import { useState } from "react";
import Link from "next/link";
import { AmaiPhone } from "@/components/amai-phone";
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
  const [panel, setPanel] = useState<"thandi" | "amai">("thandi");
  const awaiting = corridor.orders.find((order) => order.status === "awaiting_payment");

  return (
    <div className="min-h-dvh bg-[#1A1410] text-[#F6EDE6]">
      <header className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 py-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[#E7Cbb8]">MUKURU HOME · SHEHACKS</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">Johannesburg to Harare.</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#E7Cbb8]">
            Thandi sends on payday. The fee is visible, the rate locks, and Amai hears nothing until the money is real.
            Demo PIN 2580.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link href="/pitch">Panel notes</Link>
          </Button>
          <Button variant="secondary" data-testid="reset-demo" onClick={() => void corridor.resetDemo()}>
            Reset payday
          </Button>
        </div>
      </header>

      <div className="mx-auto mb-4 flex max-w-6xl px-4 lg:hidden">
        <div className="grid w-full grid-cols-2 rounded-full bg-white/10 p-1">
          {(["thandi", "amai"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={cn(
                "h-10 rounded-full text-sm font-semibold",
                panel === item ? "bg-white text-[#241910]" : "text-[#E7Cbb8]",
              )}
              onClick={() => setPanel(item)}
            >
              {item === "thandi" ? "Thandi's phone" : "Amai's phone"}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl items-start gap-8 px-4 pb-6 lg:grid-cols-2">
        <div className={cn(panel !== "thandi" && "max-lg:hidden")}>
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
        <div className={cn(panel !== "amai" && "max-lg:hidden")}>
          <AmaiPhone />
        </div>
      </main>
      <p className="sr-only" aria-live="polite">
        {corridor.notice}
      </p>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs leading-relaxed text-[#B7A297]">
        Student prototype for the Mukuru SheHacks brief. Not the real Mukuru app. The rate card, Borrowdale booth, and
        card balance are fixtures. USSD *130*567#, WhatsApp, Mukuru Card, Orange Booths, and free collection are real
        Mukuru channels this journey is built around.
      </footer>
    </div>
  );
}
