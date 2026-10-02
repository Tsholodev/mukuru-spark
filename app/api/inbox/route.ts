import { requireAccount } from "@/lib/auth";
import { listSmsDeliveryEvents, listTransfers } from "@/lib/transfers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireAccount("receiver");
  if (!account) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({
    account,
    transfers: await listTransfers(account.id, "receiver"),
    smsEvents: await listSmsDeliveryEvents(account.id),
  });
}
