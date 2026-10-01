import Link from "next/link";
import { findOrder, projectOrder, type Order } from "@/lib/engine";
import { usd, zar } from "@/lib/format";
import { amai } from "@/lib/profile";
import { readLedger } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function VoucherPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const ledger = await readLedger();
  const stored = findOrder(ledger, ref.toUpperCase());
  const order = stored ? projectOrder(stored, Date.now()) : undefined;

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
  if (!order.paidAt) {
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

  if (order.status !== "ready" && order.status !== "collected") {
    return (
      <>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Sent. Not ready to collect yet.</h1>
        <p className="mt-3 text-lg leading-relaxed">
          The money is in transit. This page changes when it is ready to collect.
        </p>
        <p className="mt-3 text-lg leading-relaxed">Yatumirwa. Haisati yagadzirira kutambirwa.</p>
      </>
    );
  }

  const wallet = order.payout === "wallet";
  return (
    <>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        {order.status === "collected" ? "Collected." : "Your money is ready to collect."}
      </h1>
      <p className="mt-2 text-lg">
        {order.status === "collected" ? "Yatambirwa." : "Mari yako yagadzirira kutambirwa."}
      </p>
      <p className="mt-4 text-lg">Amai, mari yasvika.</p>
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
