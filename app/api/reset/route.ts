import { projectLedger, rateAt } from "@/lib/engine";
import { resetLedger } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const now = Date.now();
  const ledger = projectLedger(await resetLedger(), now);
  return Response.json({
    balanceZarCents: ledger.balanceZarCents,
    orders: ledger.orders,
    openQuote: null,
    pinMisses: 0,
    fx: rateAt(now),
  });
}
