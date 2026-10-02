import { advanceTransfer, type TransferStatus } from "@/lib/transfers";
import { hasStoreAgentSession } from "@/lib/store-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: TransferStatus[] = ["IN_TRANSIT", "READY_TO_COLLECT"];

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await hasStoreAgentSession())) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (typeof body.status !== "string" || !STATUSES.includes(body.status as TransferStatus)) {
    return Response.json({ error: "invalid_status" }, { status: 400 });
  }
  const { id } = await context.params;
  try {
    const transfer = await advanceTransfer(id, null, body.status as TransferStatus);
    return Response.json({ transfer });
  } catch (error) {
    const code = error instanceof Error ? error.message : "status_update_failed";
    return Response.json({ error: code }, { status: code === "transfer_not_found" ? 404 : 409 });
  }
}