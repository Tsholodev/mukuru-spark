import { markCollected } from "@/lib/engine";
import { updateLedger } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REF = /^MUK-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;

export async function POST(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const { ref } = await context.params;
  if (!REF.test(ref)) return Response.json({ error: "bad_request" }, { status: 400 });

  const result = await updateLedger((ledger) => {
    const collected = markCollected(ledger, ref, Date.now());
    return { ledger: collected.ledger, result: collected };
  });

  if (!result.ok) {
    const status = result.error === "bad_state" ? 409 : 404;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ order: result.order, balanceZarCents: result.ledger.balanceZarCents });
}
