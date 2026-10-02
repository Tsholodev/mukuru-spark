"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
const countries = getCountries()
  .map((code) => ({
    code,
    name: countryNames.of(code) ?? code,
    callingCode: getCountryCallingCode(code),
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [role, setRole] = useState<"sender" | "receiver">("sender");
  const [preferredLanguage, setPreferredLanguage] = useState<"en" | "sn">("en");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, country, city, role, preferredLanguage, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(
          result.error === "database_not_configured"
            ? "PostgreSQL is not configured yet. Set DATABASE_URL on the server."
            : result.error === "phone_in_use"
              ? "That phone number is already registered. Sign in instead."
              : "Check the name, phone, country, city, language, and password and try again.",
        );
        return;
      }
      window.location.href = result.account.role === "sender" ? "/home" : "/collect";
    } catch {
      setError("The account could not be created. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="glass-page min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-lg">
        <p className="text-xs font-semibold tracking-[0.18em] text-[#FFD7C2]">SENDA · ACCOUNT</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Create an account</h1>
        <form className="glass mt-5 grid gap-4 rounded-xl p-5 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm text-white sm:col-span-2">
            Full name
            <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-12 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-base outline-none" />
          </label>
          <label className="block text-sm text-white">
            Account type
            <select value={role} onChange={(event) => setRole(event.target.value as "sender" | "receiver")} className="mt-1 h-12 w-full rounded-lg border border-white/20 bg-[#1E1713] px-3 text-base outline-none">
              <option value="sender">Send money</option>
              <option value="receiver">Receive money</option>
            </select>
          </label>
          <label className="block text-sm text-white">
            Preferred language
            <select value={preferredLanguage} onChange={(event) => setPreferredLanguage(event.target.value as "en" | "sn")} className="mt-1 h-12 w-full rounded-lg border border-white/20 bg-[#1E1713] px-3 text-base outline-none">
              <option value="en">English</option>
              <option value="sn">ChiShona</option>
            </select>
          </label>
          <label className="block text-sm text-white">
            Phone number
            <input required type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 h-12 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-base outline-none" />
          </label>
          <label className="block text-sm text-white">
            Phone country / calling code
            <select required value={country} onChange={(event) => setCountry(event.target.value)} className="mt-1 h-12 w-full rounded-lg border border-white/20 bg-[#1E1713] px-3 text-base outline-none">
              <option value="">Select a country</option>
              {countries.map(({ code, name, callingCode }) => (
                <option key={code} value={code}>{name} (+{callingCode})</option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-white sm:col-span-2">
            City
            <input required maxLength={100} value={city} onChange={(event) => setCity(event.target.value)} className="mt-1 h-12 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-base outline-none" />
          </label>
          <label className="block text-sm text-white sm:col-span-2">
            Password (8 characters minimum)
            <input required minLength={8} maxLength={128} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 h-12 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-base outline-none" />
          </label>
          {error && <p role="alert" className="text-sm text-[#FFD7C2] sm:col-span-2">{error}</p>}
          <button type="submit" disabled={busy} className="h-12 rounded-lg bg-white font-semibold text-[#241910] disabled:opacity-50 sm:col-span-2">
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-sm text-white">Already registered? <Link className="font-semibold underline" href="/">Sign in</Link></p>
      </div>
    </main>
  );
}