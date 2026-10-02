import { collectTransfer } from "@/lib/transfers";
import { hasStoreAgentSession } from "@/lib/store-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await hasStoreAgentSession())) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: { transferId?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (typeof body.transferId !== "string" || typeof body.code !== "string") {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const transfer = await collectTransfer(body.transferId, body.code, null);
    return Response.json({ transfer });
  } catch (error) {
    const code = error instanceof Error ? error.message : "collection_failed";
    const status = code === "transfer_not_found" ? 404 : code === "transfer_not_ready" ? 409 : 400;
    return Response.json({ error: code }, { status });
  }
}