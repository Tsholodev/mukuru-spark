# Mukuru Home

A SheHacks prototype for Mukuru's Challenge A, **Money Home, Made Simple**.

Thandi works in Johannesburg and sends money to her mother in Harare every month. Her phone is cheap, her signal drops, and she reads English more easily than she speaks it. Mukuru Home is the payday send: a plain Android screen and a USSD screen, one order engine, and a voucher that appears in Harare only after the money is real.

This is a student prototype. It is not the Mukuru app, and the rate card is illustrative.

## Run it

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847). Panel notes are at [/pitch](http://127.0.0.1:3847/pitch).

Demo PIN: **2580**. Reset payday puts the card back to R4 280.40.

## Demo

1. Read September on both phones. October is empty on Amai's side.
2. Tap **Same as September**. The large number is what she receives. The fee is inside the amount.
3. Set Thandi&apos;s signal to **None**, enter the PIN, and watch the card stay still.
4. Set the signal to **Full**. The same order completes once. Amai gets a number.
5. Optional: pay at PEP instead, and confirm Amai has no voucher until the panel marks the cash received.

## Tests

```bash
npm test
```

The tests cover the fee, the floored dollar amount, a wrong PIN, an expired rate lock, a retry that must not charge twice, and a retail payment that must not release a voucher early.

## What is real, and what is a fixture

Real Mukuru context used to shape the journey: the Mukuru Card, retail pay-in with an order number, Mukuru Wallet, Orange Booth collection with an ID, free collection, WhatsApp, and USSD `*130*567#`.

Fixtures: the rate (`R17.85 = $1` against a screen rate of `R17.42`), the fee bands, the card balance, the masked ID, and the Borrowdale booth standing in for a live Harare location.
