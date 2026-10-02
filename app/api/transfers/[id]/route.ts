import { getSession } from "@/lib/auth";
import { getTransfer } from "@/lib/transfers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const account = await getSession();
  if (!account) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const transfer = await getTransfer(id, account.id);
  if (!transfer) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ transfer });
}