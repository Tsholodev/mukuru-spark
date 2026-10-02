"use client";

import { useState, type FormEvent } from "react";

export function StoreTerminal() {
  const [authorized, setAuthorized] = useState(false);
  const [secret, setSecret] = useState("");
  const [transferId, setTransferId] = useState("");
  const [nextStatus, setNextStatus] = useState<"IN_TRANSIT" | "READY_TO_COLLECT">("IN_TRANSIT");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch("/api/store/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    });
    setBusy(false);
    if (!response.ok) {
      setMessage(response.status === 503 ? "Store access is not configured." : "Access key not recognized.");
      return;
    }
    setMessage("");
    setAuthorized(true);
  }

  async function verifyPickup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/store/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transferId: transferId.trim(), code }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(
        result.error === "expired_code"
          ? "Code expired. Ask the recipient to dial *120# for a new SMS."
          : result.error === "used_code"
            ? "This collection code has already been used."
            : result.error === "not_ready"
              ? "This transfer is not ready for collection yet."
              : "Reference or collection code could not be verified.",
      );
      return;
    }
    setMessage(`Verified. Transfer ${result.ref} is marked collected.`);
    setTransferId("");
    setCode("");
  }

  async function advanceStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/transfers/${encodeURIComponent(transferId.trim())}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const result = await response.json();
    setBusy(false);
    setMessage(response.ok ? `Transfer status is ${result.transfer.status}.` : "That status change is not valid for this transfer.");
  }

  return (
    <main className="min-h-dvh bg-[#F2F6F2] px-4 py-8 text-[#202820]">
      <div className="mx-auto max-w-md">
        <p className="text-xs font-semibold tracking-[0.16em] text-[#3E6B52]">SENDA · PARTNER TERMINAL</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Cash pickup</h1>
        <p className="mt-2 leading-relaxed text-[#526055]">Verify the transfer reference and the code from the recipient’s SMS before paying out cash.</p>

        {!authorized ? (
          <form className="mt-6 space-y-4 rounded-xl bg-white p-5 shadow-sm" onSubmit={(event) => void signIn(event)}>
            <label className="block text-sm font-medium">
              Store staff access key
              <input
                type="password"
                autoComplete="current-password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                className="mt-1 h-12 w-full rounded-lg border border-[#C8D5CB] px-3 outline-none focus:border-[#3E6B52]"
                required
              />
            </label>
            <button disabled={busy} className="h-12 w-full rounded-lg bg-[#24543A] font-semibold text-white disabled:opacity-50">
              {busy ? "Checking…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-4 rounded-xl bg-white p-5 shadow-sm" onSubmit={(event) => void verifyPickup(event)}>
            <label className="block text-sm font-medium">
              Transfer ID
              <input
                value={transferId}
                onChange={(event) => setTransferId(event.target.value)}
                autoComplete="off"
                className="mt-1 h-12 w-full rounded-lg border border-[#C8D5CB] px-3 font-mono text-sm outline-none focus:border-[#3E6B52]"
                required
              />
            </label>
            <label className="block text-sm font-medium">
              SMS collection code
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="mt-1 h-12 w-full rounded-lg border border-[#C8D5CB] px-3 font-mono text-xl tracking-[0.2em] outline-none focus:border-[#3E6B52]"
                required
              />
            </label>
            <button disabled={busy || code.length !== 6 || !transferId.trim()} className="h-12 w-full rounded-lg bg-[#24543A] font-semibold text-white disabled:opacity-50">
              {busy ? "Verifying…" : "Verify and confirm payout"}
            </button>
            <button
              type="button"
              className="h-10 w-full text-sm font-semibold text-[#526055]"
              onClick={() => void fetch("/api/store/logout", { method: "POST" }).then(() => setAuthorized(false))}
            >
              Sign out
            </button>
          </form>
        )}
        {authorized && (
          <form className="mt-4 space-y-3 rounded-xl bg-white p-5 shadow-sm" onSubmit={(event) => void advanceStatus(event)}>
            <h2 className="font-semibold">Transfer status</h2>
            <label className="block text-sm font-medium">
              Advance to
              <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as typeof nextStatus)} className="mt-1 h-12 w-full rounded-lg border border-[#C8D5CB] px-3">
                <option value="IN_TRANSIT">In transit</option>
                <option value="READY_TO_COLLECT">Ready to collect</option>
              </select>
            </label>
            <button disabled={busy || !transferId.trim()} className="h-11 w-full rounded-lg border border-[#C8D5CB] font-semibold disabled:opacity-50">
              Record status event
            </button>
          </form>
        )}
        {message && <p role="status" className="mt-4 rounded-lg bg-white p-4 text-sm leading-relaxed">{message}</p>}
      </div>
    </main>
  );
}