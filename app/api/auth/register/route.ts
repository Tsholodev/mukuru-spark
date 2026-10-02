import { registerAccount } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: {
    name?: unknown;
    phone?: unknown;
    country?: unknown;
    city?: unknown;
    role?: unknown;
    preferredLanguage?: unknown;
    password?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  if (
    typeof body.name !== "string" ||
    typeof body.phone !== "string" ||
    typeof body.country !== "string" ||
    typeof body.city !== "string" ||
    (body.role !== "sender" && body.role !== "receiver") ||
    (body.preferredLanguage !== "en" && body.preferredLanguage !== "sn") ||
    typeof body.password !== "string"
  ) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  let result;
  try {
    result = await registerAccount({
      name: body.name,
      phone: body.phone,
      country: body.country,
      city: body.city,
      role: body.role,
      preferredLanguage: body.preferredLanguage,
      password: body.password,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("DATABASE_URL is required")) {
      return Response.json({ error: "database_not_configured" }, { status: 503 });
    }
    throw error;
  }
  if ("error" in result) {
    const status = result.error === "phone_in_use" ? 409 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ account: result.account }, { status: 201 });
}