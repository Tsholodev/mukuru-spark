import { requireAccount } from "@/lib/auth";
import { normalizePhone, maskPhone } from "@/lib/passwords";
import { withDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sender = await requireAccount("sender");
  if (!sender) return Response.json({ error: "unauthorized" }, { status: 401 });

  const input = new URL(request.url).searchParams.get("phone") ?? "";
  const phoneNumber = normalizePhone(input);
  if (!phoneNumber) return Response.json({ error: "invalid_phone" }, { status: 400 });

  const recipient = await withDb(async (client) => {
    const result = await client.query(
      `select id, name, phone_number, country, preferred_language
       from users where role = 'receiver' and phone_number = $1 and id <> $2`,
      [phoneNumber, sender.id],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      name: String(row.name),
      maskedPhoneNumber: maskPhone(String(row.phone_number)),
      country: row.country == null ? null : String(row.country),
      preferredLanguage: row.preferred_language === "sn" ? "sn" : "en",
    };
  });

  if (!recipient) return Response.json({ error: "recipient_not_found" }, { status: 404 });
  return Response.json({ recipient });
}