import { openQuote, projectLedger, rateAt } from "@/lib/engine";
import { readLedger } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ledger = projectLedger(await readLedger(), Date.now());
  const now = Date.now();
  return Response.json({
    balanceZarCents: ledger.balanceZarCents,
    orders: ledger.orders,
    pinMisses: ledger.pinMisses,
    openQuote: openQuote(ledger, now),
    fx: rateAt(now),
    now,
  });
}
