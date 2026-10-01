import { ussdPress } from "@/lib/ussd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { sessionId?: unknown; key?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (typeof body.sessionId !== "string" || body.sessionId.length < 8 || body.sessionId.length > 80) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const key = typeof body.key === "string" ? body.key : "";
  const screen = await ussdPress(body.sessionId, key);
  return Response.json({ screen });
}
