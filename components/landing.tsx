"use client";

import { useState } from "react";
import Link from "next/link";

type Door = "thandi" | "amai";

export function Landing() {
  const [door, setDoor] = useState<Door>("thandi");
  const [phone, setPhone] = useState("079 000 1111");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function choose(next: Door) {
    setDoor(next);
    setError("");
    setSecret("");
    setPhone(next === "thandi" ? "079 000 1111" : "077 441 8000");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, secret }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("That phone and secret do not match. Nothing was opened.");
      return;
    }
    const body = await response.json();
    window.location.href = body.account.role === "sender" ? "/home" : "/collect";
  }

  return (
    <main className="glass-page min-h-dvh px-4 py-10">
      <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#FFD7C2]">MUKURU HOME</p>
          <h1 className="mt-3 max-w-xl text-5xl font-semibold tracking-tight text-white">
            Money home, with the fee in the open.
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-[#F6EDE6]">
            Thandi signs in from Johannesburg. Amai signs in from a cheap phone in Harare. The same orders sit in the
            database, whether they use this page or dial *120#.
          </p>
          <Link href="/ussd" className="mt-6 inline-flex h-12 items-center rounded-full bg-white/10 px-5 font-semibold text-white">
            Dial *120# on this phone
          </Link>
        </section>
        <section className="glass rounded-[2rem] p-6">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="door-thandi"
              className={`h-12 rounded-full font-semibold ${door === "thandi" ? "bg-[#E65300] text-white" : "bg-white/10 text-white"}`}
              onClick={() => choose("thandi")}
            >
              I am Thandi
            </button>
            <button
              type="button"
              data-testid="door-amai"
              className={`h-12 rounded-full font-semibold ${door === "amai" ? "bg-[#E65300] text-white" : "bg-white/10 text-white"}`}
              onClick={() => choose("amai")}
            >
              I am Amai
            </button>
          </div>
          <form className="mt-6 space-y-3" onSubmit={(event) => void submit(event)}>
            <label className="block text-sm text-[#F6EDE6]">
              Phone
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="username"
                className="mt-1 h-12 w-full rounded-2xl border border-white/20 bg-white/10 px-4 text-lg text-white outline-none"
              />
            </label>
            <label className="block text-sm text-[#F6EDE6]">
              {door === "thandi" ? "Password" : "PIN"}
              <input
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                type={door === "thandi" ? "password" : "text"}
                inputMode={door === "amai" ? "numeric" : "text"}
                autoComplete="current-password"
                data-testid="login-secret"
                className="mt-1 h-12 w-full rounded-2xl border border-white/20 bg-white/10 px-4 text-lg text-white outline-none"
              />
            </label>
            {error && <p className="text-sm text-[#FFD7C2]">{error}</p>}
            <button
              type="submit"
              data-testid="login-submit"
              disabled={busy}
              className="h-12 w-full rounded-full bg-white font-semibold text-[#241910] disabled:opacity-40"
            >
              {busy ? "Opening…" : "Open my account"}
            </button>
            <p className="text-sm leading-relaxed text-[#E7Cbb8]">
              {door === "thandi"
                ? "Demo sign-in 079 000 1111 and 25802580. The card PIN inside a send is still 2580."
                : "Demo sign-in 077 441 8000 and PIN 4418. Big type, short page, same orders as Thandi."}
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
