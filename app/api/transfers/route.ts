import { requireAccount } from "@/lib/auth";
import { confirmTransfer, getSenderBalance, listTransfers } from "@/lib/transfers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireAccount("sender");
  if (!account) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({
    availableBalanceMinor: await getSenderBalance(account.id),
    sourceCurrency: process.env.SOURCE_CURRENCY ?? null,
    transfers: await listTransfers(account.id, "sender"),
  });
}

export async function POST(request: Request) {
  const account = await requireAccount("sender");
  if (!account) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { quoteId?: unknown; idempotencyKey?: unknown; confirmed?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (typeof body.quoteId !== "string" || typeof body.idempotencyKey !== "string" || body.confirmed !== true) {
    return Response.json({ error: "confirmation_required" }, { status: 400 });
  }

  try {
    const result = await confirmTransfer(account.id, body.quoteId, body.idempotencyKey, true);
    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "transfer_failed";
    const status = code === "quote_not_found" ? 404 : code === "quote_expired" || code === "quote_already_used" ? 409 : code === "insufficient_balance" ? 402 : 400;
    return Response.json({ error: code }, { status });
  }
}