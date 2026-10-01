import { markPaid } from "@/lib/engine";
import { updateLedger } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REF = /^MUK-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;

export async function POST(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const { ref } = await context.params;
  if (!REF.test(ref)) return Response.json({ error: "bad_request" }, { status: 400 });

  const result = await updateLedger((ledger) => {
    const paid = markPaid(ledger, ref, Date.now());
    return { ledger: paid.ledger, result: paid };
  });

  if (!result.ok) return Response.json({ error: result.error }, { status: 404 });
  return Response.json({ order: result.order, balanceZarCents: result.ledger.balanceZarCents });
}
