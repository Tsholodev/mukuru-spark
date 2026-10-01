import { getSession, setLanguage } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const account = await getSession();
  if (!account) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ account });
}

export async function PATCH(request: Request) {
  const account = await getSession();
  if (!account) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: { lang?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (body.lang !== "en" && body.lang !== "sn") return Response.json({ error: "bad_request" }, { status: 400 });
  await setLanguage(account.id, body.lang);
  return Response.json({ account: { ...account, lang: body.lang } });
}
