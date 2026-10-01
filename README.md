# Mukuru Home

A SheHacks prototype for Mukuru's Challenge A, **Money Home, Made Simple**.

Thandi works in Johannesburg and sends money to her mother in Harare every month. Her phone is cheap, her signal drops, and she reads English more easily than she speaks it. Mukuru Home is the payday send: English and ChiShona, a plain Android screen and a USSD *120# screen, a status line from Sent to Collected, and a voucher that appears in Harare only when the money is ready to collect.

This is a student prototype. It is not the Mukuru app. The rate moves on a timer so the lock is visible. It is not Mukuru's live quote.

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
4. Set the signal to **Full**. The same order completes once. The status walks Sent, In transit, then Ready to collect. Amai's phone says "Your money is ready to collect."
5. Optional: switch to ChiShona or Icons. Optional: pay at PEP instead, and confirm Amai has no voucher until the panel marks the cash received and the status reaches ready.

## Tests

```bash
npm test
```

The tests cover the fee, the floored dollar amount, a rate that changes, the Sent to Collected walk, a wrong PIN, an expired rate lock, a retry that must not charge twice, and a retail payment that must not release a voucher early.

## What is real, and what is a fixture

Real Mukuru context used to shape the journey: the Mukuru Card, retail pay-in with an order number, Mukuru Wallet, Orange Booth collection with an ID, free collection, and WhatsApp. Mukuru's live USSD code is `*130*567#`. This demo dials `*120#`, because that is what the brief asks to simulate.

Fixtures: the moving rate (it steps around a mid rate near `R17.42`, with the customer rate a bit higher), the fee bands, the card balance, the masked ID, and the Borrowdale booth standing in for a live Harare location. September's send stays at `$107.61`.
