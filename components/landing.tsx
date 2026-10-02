"use client";

import { useState } from "react";
import Link from "next/link";
import { publicDemoConfig } from "@/lib/public-config";

type Door = "sender" | "receiver";

export function Landing({ databaseUnavailable = false }: { databaseUnavailable?: boolean }) {
  const [door, setDoor] = useState<Door>("sender");
  const [phone, setPhone] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function choose(next: Door) {
    setDoor(next);
    setError("");
    setSecret("");
    setPhone("");
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
      const body = await response.json().catch(() => null);
      setError(body?.error === "database_not_configured"
        ? "PostgreSQL is not configured yet. Set DATABASE_URL on the server."
        : "That phone and password do not match. Nothing was opened.");
      return;
    }
    const body = await response.json();
    window.location.href = body.account.role === "sender" ? "/home" : "/collect";
  }

  return (
    <main className="glass-page min-h-dvh px-4 py-10">
      <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#FFD7C2]">{publicDemoConfig.appName.toUpperCase()} · MONEY TRANSFERS</p>
          <h1 className="mt-3 max-w-xl text-5xl font-semibold tracking-tight text-white">
            Send money home. Know exactly what arrives.
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-[#F6EDE6]">
            Choose a registered recipient, see the full cost and payout first, then confirm securely.
          </p>
          {databaseUnavailable && (
            <p role="status" className="mt-4 max-w-lg rounded-lg border border-[#FFD7C2]/40 bg-white/10 p-3 text-sm text-white">
              Connect PostgreSQL with DATABASE_URL in the server environment to enable accounts and transfers.
            </p>
          )}
          <Link href="/ussd" className="mt-6 inline-flex h-12 items-center rounded-full bg-white/10 px-5 font-semibold text-white">
            Try the {publicDemoConfig.ussdDemoCode} USSD flow
          </Link>
        </section>
        <section className="glass rounded-[2rem] p-6">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="door-sender"
              aria-pressed={door === "sender"}
              className={`h-12 rounded-full font-semibold ${door === "sender" ? "bg-[#E65300] text-white" : "bg-white/10 text-white"}`}
              onClick={() => choose("sender")}
            >
              Send money
            </button>
            <button
              type="button"
              data-testid="door-recipient"
              aria-pressed={door === "receiver"}
              className={`h-12 rounded-full font-semibold ${door === "receiver" ? "bg-[#E65300] text-white" : "bg-white/10 text-white"}`}
              onClick={() => choose("receiver")}
            >
              Collect money
            </button>
          </div>
          <p className="mt-4 text-sm text-[#E7Cbb8]">
            New here? <Link className="font-semibold text-white underline" href="/register">Create an account</Link>
          </p>
          <form className="mt-6 space-y-3" onSubmit={(event) => void submit(event)}>
            <label className="block text-sm text-[#F6EDE6]">
              Mobile number
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="username"
                className="mt-1 h-12 w-full rounded-2xl border border-white/20 bg-white/10 px-4 text-lg text-white outline-none"
              />
            </label>
            <label className="block text-sm text-[#F6EDE6]">
              Password
              <input
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                type="password"
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
            <p className="text-sm leading-relaxed text-[#E7Cbb8]">Use the phone number and password registered to this account.</p>
          </form>
        </section>
      </div>
    </main>
  );
}
