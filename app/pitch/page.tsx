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
            company. People send from the app, from WhatsApp, from a mobi site, or by dialling *130*567#. This demo
            dials *120#, because that is the code on the brief. The person in Harare gets a voucher and collects with
            their ID. Mukuru says collection at its booths is free, and the Wallet in Zimbabwe pays out international
            transfers without a cash-out fee.
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
            The brief is a customer, plus a short core list and a bonus list. The product follows that sheet. It does
            not add a second product for Grace or Blessing.
          </p>
        </Section>

        <Section title="Mapped to the brief">
          <p>Core, the things the sheet says to build:</p>
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <strong>Send-money journey.</strong> Same as September, or another amount, from the card or as cash at PEP.
              The order is simulated from Thandi to Amai.
            </li>
            <li>
              <strong>Fees and the rate, before she pays.</strong> The large number is what Amai receives. The fee sits
              inside the rand amount. The screen rate and the transfer rate are both on the card. Collection is R0.
            </li>
            <li>
              <strong>Status.</strong> After the card is charged, both phones show Sent, then In transit, then Ready to
              collect, then Collected. Amai does not get a voucher number until it is ready.
            </li>
            <li>
              <strong>Two languages.</strong> English and ChiShona, on both phones and on the *120# menu. English is the
              source of truth. Have a Shona speaker read the ChiShona out loud before the pitch.
            </li>
          </ul>
          <p>Bonus:</p>
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <strong>WhatsApp and USSD.</strong> The Android screen reads like a chat. USSD *120# is the cheap-phone
              path. Mukuru&apos;s live code is *130*567#. The demo follows the brief.
            </li>
            <li>
              <strong>Low signal.</strong> Full, 1 bar, and None. None seals the order on the phone. The same key is
              used when the signal returns, so the card is charged once. Amai is not told while it is held.
            </li>
            <li>
              <strong>The receiver line.</strong> When the status reaches Ready to collect, Amai&apos;s phone says
              &quot;Your money is ready to collect.&quot; The WhatsApp text starts with that same sentence.
            </li>
            <li>
              <strong>Icons, not voice.</strong> Thandi reads English better than she speaks it, so the bonus is an
              icon-led mode, not a voice UI. The status steps stay labelled.
            </li>
            <li>
              <strong>A rate that moves.</strong> The demo rate steps every 20 seconds. A locked quote keeps the rate
              from the moment she locked it. If the live rate moves, the phone says hers is still locked.
            </li>
          </ul>
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
            <li>Payday opens on 1 October. The card has R4 280.40. September already reached Amai and was collected.</li>
            <li>Same as September locks a quote. The big number is what Amai receives, not what leaves the card.</li>
            <li>The fee sits inside the amount. The screen rate and the transfer rate are both shown. Collection is R0. The live rate in the corner can move. The locked rate does not.</li>
            <li>Pay from the Mukuru Card, or start an order and pay cash at PEP. Nothing is told to Amai until the cash is confirmed, and even then she waits until the status says ready.</li>
            <li>Signal can be Full, 1 bar, or None. None seals the order on the phone. The same key is used when the signal returns, so the card is charged once.</li>
            <li>The Android screen and USSD *120# share that order engine. English and ChiShona share it too. Icons is the low-literacy mode.</li>
            <li>About eight seconds after a real payment, both phones reach Ready to collect. Amai&apos;s line is &quot;Your money is ready to collect.&quot;</li>
          </ul>
        </Section>

        <Section title="Demo, in this order">
          <ol className="list-decimal space-y-3 pl-5">
            <li>Show both phones. September is collected on Amai&apos;s side. October is empty. Reset payday if a previous send is still there.</li>
            <li>Tap Same as September. Read the fee, the two rates, and the dollars before anyone pays. Point at the live rate.</li>
            <li>Set Thandi&apos;s signal to None. Enter PIN 2580. The card balance does not move. Amai&apos;s phone still says nothing new.</li>
            <li>Set the signal back to Full. The same order completes by itself. The balance drops once. Read Sent, then In transit. Wait until Ready to collect. Amai&apos;s phone says &quot;Your money is ready to collect.&quot;</li>
            <li>Optional: switch to ChiShona, then Icons, and show the same steps without a new send.</li>
            <li>Optional: Reset, choose Pay cash at PEP, and show that Amai still has no voucher. Then use the panel control to mark the PEP cash received. She still waits for Ready to collect.</li>
            <li>Optional: Switch to USSD *120# and send a smaller amount on 1 bar.</li>
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
            English is the default because Thandi reads English more easily than she speaks it. ChiShona is the second
            language the brief asks for, on the whole send, not only the voucher. There is no voice UI and no call
            button on the happy path. Have a first-language Shona speaker read the ChiShona out loud before the pitch.
            The English next to it is the source of truth.
          </p>
          <p>
            The moving rate, the fee bands, the R4 280.40 balance, the masked ID, and the Borrowdale booth are demo
            fixtures. September stays at $107.61 so the payday story does not jump. A new October quote uses the rate
            at the moment she locks it, so it may not be $107.61. The channels are not fixtures: Card, PEP-style retail
            pay-in, Wallet, Orange Booth, voucher plus ID, free collection, and WhatsApp are how this corridor already
            works. The live USSD code is *130*567#. The brief asked for *120#, so that is what the demo dials.
          </p>
        </Section>

        <Section title="Left out on purpose">
          <p>
            No points, no game, no chatbot, no second product for Grace or Blessing. No voice UI, because she reads
            better than she speaks. A production version would have the contact-centre language team review ChiShona,
            isiNdebele, and isiZulu, and would swap the demo rate for Mukuru&apos;s live quote.
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
