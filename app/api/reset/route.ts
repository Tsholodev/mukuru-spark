import { resetLedger } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const ledger = await resetLedger();
  return Response.json({
    balanceZarCents: ledger.balanceZarCents,
    orders: ledger.orders,
    openQuote: null,
    pinMisses: 0,
  });
}
