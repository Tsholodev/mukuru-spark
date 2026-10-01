import Link from "next/link";
import { findOrder, type Order } from "@/lib/engine";
import { usd, zar } from "@/lib/format";
import { amai } from "@/lib/profile";
import { readLedger } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function VoucherPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const ledger = await readLedger();
  const order = findOrder(ledger, ref.toUpperCase());

  return (
    <main className="min-h-dvh bg-white text-[#241910]">
      <div className="mx-auto max-w-md px-5 py-8">
        <p className="text-xs font-semibold tracking-[0.16em] text-[#9A7B68]">MUKURU HOME</p>
        {order ? <Voucher order={order} /> : <Missing ref={ref.toUpperCase()} />}
        <p className="mt-10 text-xs leading-relaxed text-[#9A7B68]">
          Student prototype. Not an official Mukuru voucher. A real collection still happens only on a number Mukuru
          sends after it has been paid.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-[#E65300]">
          Back to the desk
        </Link>
      </div>
    </main>
  );
}

function Missing({ ref }: { ref: string }) {
  return (
    <>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">No voucher under {ref || "that number"}.</h1>
      <p className="mt-3 text-lg leading-relaxed">If someone sent you a screenshot, that is not proof of payment.</p>
    </>
  );
}

function Voucher({ order }: { order: Order }) {
  if (!order.voucherAt) {
    return (
      <>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">This is not a voucher.</h1>
        <p className="mt-3 text-lg leading-relaxed">
          Mukuru has not been paid for this order. Do not collect cash, and do not give anything against a screenshot.
        </p>
        <p className="mt-3 text-lg leading-relaxed">Hapana nhamba yekutora. Usapa chinhu ne screenshot.</p>
      </>
    );
  }

  const wallet = order.payout === "wallet";
  return (
    <>
      <h1 className="mt-4 text-lg">Amai, mari yasvika.</h1>
      <p className="mt-2 text-5xl font-semibold tracking-tight tabular-nums">{usd(order.usdOutCents)}</p>
      <p className="mt-6 font-mono text-4xl font-medium tracking-wide">{order.ref}</p>
      <p className="mt-6 text-lg leading-relaxed">
        {wallet
          ? "This is in your Mukuru Wallet. Notes at an Orange Booth are free on this transfer."
          : `Collect the notes at ${amai.booth}. Bring the ID that says ${amai.name}.`}
      </p>
      <p className="mt-3 text-lg leading-relaxed">
        {wallet ? "Mari iri muWallet. Kubuda pabooth hakubhadharwi." : "Uya neID inoti Rudo Ncube. Kutora hakubhadharwi."}
      </p>
      <p className="mt-6 text-lg leading-relaxed">Mukuru will not phone you to ask for a PIN, a card number, or this number.</p>
      <p className="mt-2 text-lg leading-relaxed">Mukuru haikumbiri PIN panhare.</p>
      <p className="mt-6 text-base text-[#6D5E55]">
        {order.payWith === "card"
          ? `${zar(order.amountZarCents)} left Thandi's card. Fee ${zar(order.feeZarCents)} was inside it.`
          : "Paid in cash at a Mukuru pay-in partner. The card was not used."}
      </p>
    </>
  );
}
