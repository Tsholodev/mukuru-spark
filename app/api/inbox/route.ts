import { projectOrder } from "@/lib/engine";
import { requireAccount } from "@/lib/auth";
import { readLedger } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireAccount("receiver");
  if (!account) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ledger = await readLedger();
  const now = Date.now();
  return Response.json({
    account,
    orders: ledger.orders.map((order) => projectOrder(order, now)),
  });
}
