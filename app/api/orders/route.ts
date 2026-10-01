import { randomBytes } from "crypto";
import { requireAccount } from "@/lib/auth";
import { placeOrder, type PayWith } from "@/lib/engine";
import { updateLedger } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newRef() {
  const bytes = randomBytes(5);
  let ref = "MUK-";
  for (let i = 0; i < 5; i++) ref += ALPHABET[bytes[i] % ALPHABET.length];
  return ref;
}

export async function POST(request: Request) {
  let body: {
    quoteId?: unknown;
    pin?: unknown;
    idempotencyKey?: unknown;
    payWith?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  if (typeof body.quoteId !== "string" || typeof body.pin !== "string" || typeof body.idempotencyKey !== "string") {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (body.payWith !== "card" && body.payWith !== "retail") {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const account = await requireAccount("sender");
  if (!account) return Response.json({ error: "unauthorized" }, { status: 401 });

  const placed = await updateLedger((ledger) => {
    const result = placeOrder(
      ledger,
      {
        quoteId: body.quoteId as string,
        pin: body.pin as string,
        idempotencyKey: body.idempotencyKey as string,
        payWith: body.payWith as PayWith,
      },
      Date.now(),
      newRef,
    );
    return { ledger: result.ledger, result };
  });

  if (!placed.ok) {
    const status =
      placed.error === "bad_pin" ? 401 : placed.error === "insufficient" ? 402 : placed.error === "quote_expired" ? 409 : 400;
    return Response.json({ error: placed.error, pinMisses: placed.ledger.pinMisses }, { status });
  }

  return Response.json({
    order: placed.order,
    balanceZarCents: placed.ledger.balanceZarCents,
  });
}
