type ExchangeRateResponse = {
  result?: string;
  rates?: Record<string, number>;
};

export async function getExchangeRate(sourceCurrency: string, destinationCurrency: string): Promise<number> {
  const endpoint = process.env.EXCHANGE_RATE_API_URL?.replace(/\/$/, "");
  if (!endpoint) throw new Error("exchange_rate_not_configured");

  const response = await fetch(`${endpoint}/${encodeURIComponent(sourceCurrency)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("exchange_rate_unavailable");
  const result = (await response.json()) as ExchangeRateResponse;
  const rate = result.rates?.[destinationCurrency];
  if (result.result !== "success" || typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("exchange_rate_unavailable");
  }
  return rate;
}