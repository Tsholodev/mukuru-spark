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
  let account;
  try {
    account = await login(body.phone, body.secret);
  } catch (error) {
    if (error instanceof Error && error.message.includes("DATABASE_URL is required")) {
      return Response.json({ error: "database_not_configured" }, { status: 503 });
    }
    throw error;
  }
  if (!account) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ account });
}
