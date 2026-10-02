import { clearStoreAgentSession } from "@/lib/store-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearStoreAgentSession();
  return Response.json({ ok: true });
}