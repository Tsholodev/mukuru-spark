"use client";

import type { OrderStatus } from "@/lib/engine";
import { t, type Lang } from "@/lib/copy";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "sent", icon: "↗" },
  { id: "inTransit", icon: "→" },
  { id: "ready", icon: "⌂" },
  { id: "collected", icon: "✓" },
] as const;

function stepIndex(status: OrderStatus) {
  if (status === "sent") return 0;
  if (status === "in_transit") return 1;
  if (status === "ready") return 2;
  if (status === "collected") return 3;
  return -1;
}

export function StatusTrack({
  status,
  lang,
  icons,
}: {
  status: OrderStatus;
  lang: Lang;
  icons: boolean;
}) {
  const current = stepIndex(status);
  return (
    <ol className="grid grid-cols-4 gap-1" data-testid="status-track" aria-label="Money status">
      {STEPS.map((step, index) => {
        const on = index <= current;
        return (
          <li key={step.id} className="text-center">
            <span
              className={cn(
                "mx-auto flex items-center justify-center rounded-full font-semibold",
                icons ? "h-10 w-10 text-lg" : "h-7 w-7 text-xs",
                on ? "bg-[#E65300] text-white" : "bg-[#F3E8DF] text-[#9A7B68]",
              )}
            >
              {step.icon}
            </span>
            <span className={cn("mt-1 block leading-tight", icons ? "text-[11px]" : "text-[10px]", on ? "text-[#241910]" : "text-[#9A7B68]")}>
              {t(lang, step.id)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
