import { randomUUID } from "crypto";
import { requireAccount } from "@/lib/auth";
import { addQuote, buildQuote, type Payout } from "@/lib/engine";
import { updateLedger } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { amountZarCents?: unknown; payout?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const account = await requireAccount("sender");
  if (!account) return Response.json({ error: "unauthorized" }, { status: 401 });

  const amount = body.amountZarCents;
  const payout = body.payout;
  if (typeof amount !== "number" || (payout !== "wallet" && payout !== "cash")) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const built = buildQuote(amount, payout as Payout, Date.now(), randomUUID());
  if (!built.ok) return Response.json({ error: built.error }, { status: 400 });

  await updateLedger((ledger) => ({
    ledger: addQuote(ledger, built.quote),
    result: built.quote,
  }));

  return Response.json({ quote: built.quote });
}
