import { login } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { phone?: unknown; secret?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (typeof body.phone !== "string" || typeof body.secret !== "string") {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const account = await login(body.phone, body.secret);
  if (!account) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ account });
}
