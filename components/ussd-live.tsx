"use client";

import { useEffect, useState } from "react";

export function UssdLive() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [screen, setScreen] = useState("Dialling *120#…");
  const [ready, setReady] = useState(false);

  async function press(key: string) {
    const response = await fetch("/api/ussd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, key }),
    });
    const body = await response.json();
    if (typeof body.screen === "string") setScreen(body.screen);
  }

  useEffect(() => {
    if (ready) return;
    setReady(true);
    void press("");
    // The session id is fixed for this phone. One opening request is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#102116] text-[#D7F5B8]">
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-4 py-4 font-mono text-[15px] leading-relaxed" data-testid="ussd-screen">
        {screen}
      </pre>
      <div className="grid shrink-0 grid-cols-3 gap-1.5 p-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"].map((key) => (
          <button
            key={key}
            type="button"
            data-testid={`ussd-${key}`}
            className="h-11 rounded-lg bg-[#1B3424] font-mono text-sm font-medium text-[#D7F5B8]"
            onClick={() => void press(key)}
          >
            {key === "del" ? "⌫" : key === "ok" ? "OK" : key}
          </button>
        ))}
      </div>
    </div>
  );
}
