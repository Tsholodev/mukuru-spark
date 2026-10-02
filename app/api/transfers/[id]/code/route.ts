import { requireAccount } from "@/lib/auth";
import { reissueTransferCollectionCode } from "@/lib/transfers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const account = await requireAccount("receiver");
  if (!account) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    const smsStatus = await reissueTransferCollectionCode(id, account.id);
    return Response.json({ smsStatus });
  } catch (error) {
    const code = error instanceof Error ? error.message : "code_reissue_failed";
    return Response.json({ error: code }, { status: code === "transfer_not_found" ? 404 : 400 });
  }
}