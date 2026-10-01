import type { Order } from "./engine";
import { usd } from "./format";

export function voucherMessage(order: Order): string {
  const dollars = usd(order.usdOutCents);
  const where =
    order.payout === "wallet"
      ? `${dollars} iri muMukuru Wallet.\n${dollars} is in your Mukuru Wallet.`
      : `${dollars} iri paOrange Booth, Borrowdale.\n${dollars} is waiting at the Orange Booth in Borrowdale.`;
  return [
    "Amai, mari yasvika.",
    where,
    `Nhamba / Number: ${order.ref}`,
    "Uya neID inoti Rudo Ncube.",
    "Bring the ID that says Rudo Ncube.",
    "Mukuru haikumbiri PIN panhare.",
    "Mukuru will not phone you to ask for a PIN.",
    "— Thandi",
  ].join("\n");
}
