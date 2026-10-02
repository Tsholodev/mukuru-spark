import { requireAccount } from "@/lib/auth";
import { createTransferQuote } from "@/lib/transfers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { recipientId?: unknown; amountMinor?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const account = await requireAccount("sender");
  if (!account) return Response.json({ error: "unauthorized" }, { status: 401 });

  if (typeof body.recipientId !== "string" || typeof body.amountMinor !== "number") {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  try {
    const quote = await createTransferQuote(account.id, body.recipientId, body.amountMinor);
    return Response.json({ quote });
  } catch (error) {
    const code = error instanceof Error ? error.message : "quote_failed";
    const status = code === "recipient_not_found" ? 404 : code === "invalid_amount" ? 400 : 503;
    return Response.json({ error: code }, { status });
  }
}
