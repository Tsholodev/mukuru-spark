import { openQuote } from "@/lib/engine";
import { readLedger } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ledger = await readLedger();
  const now = Date.now();
  return Response.json({
    balanceZarCents: ledger.balanceZarCents,
    orders: ledger.orders,
    pinMisses: ledger.pinMisses,
    openQuote: openQuote(ledger, now),
    now,
  });
}
