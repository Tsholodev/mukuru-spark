import { createHash, timingSafeEqual } from "crypto";
import { createStoreAgentSession } from "@/lib/store-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { secret?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (typeof body.secret !== "string") return Response.json({ error: "bad_request" }, { status: 400 });

  const expectedSecret = process.env.STORE_AGENT_SECRET;
  if (!expectedSecret) return Response.json({ error: "store_access_not_configured" }, { status: 503 });
  const supplied = createHash("sha256").update(body.secret).digest();
  const expected = createHash("sha256").update(expectedSecret).digest();
  if (!timingSafeEqual(supplied, expected)) return Response.json({ error: "unauthorized" }, { status: 401 });

  await createStoreAgentSession();
  return Response.json({ ok: true });
}