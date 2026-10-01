import Link from "next/link";

export default function PitchPage() {
  return (
    <main className="min-h-dvh bg-[#FFF9F4] text-[#241910]">
      <article className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-xs font-semibold tracking-[0.18em] text-[#E65300]">MUKURU SHEHACKS · CHALLENGE A</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Mukuru Home</h1>
        <p className="mt-4 text-xl leading-relaxed">
          Thandi in Johannesburg sends to her mother in Harare on a cheap phone, on one bar of signal, in words she can
          read. The send should feel as trustworthy as a WhatsApp. Harare is told only when the money is real.
        </p>
        <p className="mt-6">
          <Link href="/" className="font-semibold text-[#E65300]">
            Open the desk
          </Link>
        </p>

        <Section title="Who Mukuru is">
          <p>
            Mukuru is a Cape Town fintech, started in 2004, built for people sending money home. It now serves more
            than 17 million customers, with money transfers, the Mukuru Card, Mukuru Wallet, funeral cover, and a few
            hundred thousand pay-in and pay-out points. The South Africa to Zimbabwe corridor is the heart of the
            company. People send from the app, from WhatsApp, from a mobi site, or by dialling *130*567#. The person
            in Harare gets a voucher and collects with their ID. Mukuru says collection at its booths is free, and the
            Wallet in Zimbabwe pays out international transfers without a cash-out fee.
          </p>
          <p>
            SheHacks is Mukuru&apos;s hackathon with WeThinkCode_, running since 2022, for women building against a real
            customer problem. In 2024 the winners were the teams who met the brief and designed for a broad customer,
            not the teams who added extra scope. That is the standard I built for.
          </p>
        </Section>

        <Section title="The three briefs">
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <strong>A · Money Home, Made Simple.</strong> Thandi works in Johannesburg and sends to her mother in
              Harare every month. Her phone is cheap, her signal is unreliable, and she reads English better than she
              speaks it.
            </li>
            <li>
              <strong>B · Money Coach.</strong> Grace supports two households, does not trust a bank account, and needs
              a nudge toward her sister&apos;s school fees. Not a lecture.
            </li>
            <li>
              <strong>C · Scam Shield.</strong> Blessing is new in a city and looking for work. One fake job, one
              phishing text, or one romance scam can cost a month&apos;s wages.
            </li>
          </ul>
          <p>
            The page says these are customer problems, not spec sheets. Part of the challenge is deciding what to build.
            The screenshots cut off the core and bonus lists, so the product is scoped from the customer, from how
            Mukuru actually sends on this corridor, and from what previous winning teams were praised for.
          </p>
        </Section>

        <Section title="Why A, and not a dashboard">
          <p>
            A is the company&apos;s own product, with constraints that punish a generic fintech screen. Most teams will
            ship a multi-step form that assumes fast internet and fluent English. That fails Thandi on the first bar
            of signal.
          </p>
          <p>
            B matters, and Mukuru does not have a strong savings coach. It is also the shape of every student budgeting
            app, and SheHacks already set a financial-education brief in 2022. C matters too — Mukuru publishes a hard
            fraud line, and agents do not phone people for PINs — but a keyword scanner looks like every other
            hackathon. I pulled that rule into the send itself.
          </p>
          <p>
            The decision: build the monthly send, and make the failure modes the product. The money must not move
            twice. Amai must not be told before Mukuru has been paid. The price must be visible before the PIN.
          </p>
        </Section>

        <Section title="What the desk does">
          <ul className="list-disc space-y-3 pl-5">
            <li>Payday opens on 1 October. The card has R4 280.40. September already reached Amai and was cashed out.</li>
            <li>Same as September locks a quote. The big number is what Amai receives, not what leaves the card.</li>
            <li>The fee sits inside the amount. The screen rate and the transfer rate are both shown. Collection is R0.</li>
            <li>Pay from the Mukuru Card, or start an order and pay cash at PEP. The voucher is withheld until PEP confirms.</li>
            <li>Signal can be Full, 1 bar, or None. None seals the order on the phone. The same key is used when the signal returns, so the card is charged once.</li>
            <li>The Android screen and USSD *130*567# share that order engine. USSD is the cheap-phone surface.</li>
            <li>Amai&apos;s phone, and the light page at her link, stay empty until the voucher exists. The message she can forward on WhatsApp says Mukuru will not ask for a PIN.</li>
          </ul>
        </Section>

        <Section title="Demo, in this order">
          <ol className="list-decimal space-y-3 pl-5">
            <li>Show both phones. September is cashed out on Amai&apos;s side. October is empty. Reset payday if a previous send is still there.</li>
            <li>Tap Same as September. Read the fee, the two rates, and the dollars before anyone pays.</li>
            <li>Set Thandi&apos;s signal to None. Enter PIN 2580. The card balance does not move. Amai&apos;s phone still says nothing new.</li>
            <li>Set the signal back to Full. The same order completes by itself. The balance drops once. Amai gets a number.</li>
            <li>Optional: Reset, choose Pay cash at PEP, and show that Amai still has no voucher. Then use the panel control to mark the PEP cash received.</li>
            <li>Optional: Switch to USSD and send a smaller amount on 1 bar. Leave the &quot;do not press again&quot; line on screen while it works.</li>
          </ol>
        </Section>

        <Section title="If they ask">
          <p>
            The retry key is stored on the phone before the request leaves. A repeated request with that key returns
            the original order and does not charge again. A wrong PIN does not consume the quote. A locked rate lasts
            15 minutes; after that, nothing is charged and she has to look at the new numbers. Dollars are rounded down,
            so the screen never promises a cent the rate does not cover.
          </p>
          <p>
            English is the interface because Thandi reads English more easily than she speaks it. The sentences are
            short on purpose. There is no call button on the happy path. ChiShona is on the voucher and the WhatsApp
            text, because that is the message that crosses the border. Have a Shona speaker read those lines out loud
            before the pitch. The English next to them is the source of truth.
          </p>
          <p>
            The rate card, the R4 280.40 balance, the masked ID, and the Borrowdale booth are demo fixtures. They stand
            in for a live quote and for Mukuru&apos;s real Harare booths. The channels are not fixtures: Card, PEP-style
            retail pay-in, Wallet, Orange Booth, voucher plus ID, free collection, WhatsApp, and *130*567# are how this
            corridor already works.
          </p>
        </Section>

        <Section title="Left out on purpose">
          <p>
            No points, no game, no chatbot, no second product for Grace or Blessing. Those would look busy and miss
            the customer in the brief. A production version would add full ChiShona, isiNdebele, and isiZulu, reviewed
            by the contact-centre language team, and would swap the demo rate for Mukuru&apos;s live quote.
          </p>
        </Section>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-[17px] leading-relaxed">{children}</div>
    </section>
  );
}
