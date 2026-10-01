export function zar(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const rands = Math.floor(abs / 100);
  const frac = abs % 100;
  const grouped = rands.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${negative ? "-" : ""}R${grouped}.${frac.toString().padStart(2, "0")}`;
}

export function usd(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100);
  const frac = abs % 100;
  const grouped = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${grouped}.${frac.toString().padStart(2, "0")}`;
}

export function rateLabel(milli: number): string {
  return `R${(milli / 1000).toFixed(2)} = $1`;
}

export function when(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Johannesburg",
  }).format(new Date(ms));
}

export function parseRands(input: string): number | null {
  const trimmed = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

export function day(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(ms));
}
