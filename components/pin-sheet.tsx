"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/copy";
import { useCorridor } from "@/components/corridor-context";
import { Button } from "@/components/ui/button";

export function PinSheet({
  open,
  title,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => void;
}) {
  const { lang } = useCorridor();
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (open) setPin("");
  }, [open]);

  if (!open) return null;

  function press(digit: string) {
    setPin((current) => (current.length >= 4 ? current : current + digit));
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <div className="absolute inset-0 z-20 flex items-end bg-[#241910]/40" role="dialog" aria-modal="true" aria-label="Enter PIN">
      <div className="w-full rounded-t-[1.6rem] bg-[#FFF9F4] px-4 pb-4 pt-5">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#E7D9CE]" />
        <h2 className="text-lg font-semibold text-[#241910]">{title}</h2>
        <p className="mt-1 text-sm text-[#6D5E55]">{t(lang, "pinHelp")}</p>
        <div className="mt-4 flex justify-center gap-3" data-testid="pin-display">
          {Array.from({ length: 4 }, (_, index) => (
            <span
              key={index}
              className="flex h-12 w-10 items-center justify-center rounded-xl border border-[#E7D9CE] bg-white text-xl"
            >
              {pin[index] ? "•" : ""}
            </span>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {keys.map((key) =>
            key === "" ? (
              <span key="blank" />
            ) : (
              <button
                key={key}
                type="button"
                className="h-14 rounded-2xl bg-white text-xl font-semibold text-[#241910] shadow-sm"
                data-testid={key === "del" ? "pin-delete" : `pin-${key}`}
                onClick={() => (key === "del" ? setPin((current) => current.slice(0, -1)) : press(key))}
              >
                {key === "del" ? "⌫" : key}
              </button>
            ),
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t(lang, "notNow")}
          </Button>
          <Button data-testid="pin-submit" disabled={busy || pin.length !== 4} onClick={() => onSubmit(pin)}>
            {busy ? t(lang, "sending") : t(lang, "send")}
          </Button>
        </div>
      </div>
    </div>
  );
}
