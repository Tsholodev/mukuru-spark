# Senda

A 48-hour hackathon prototype for Challenge A, **Money Home, Made Simple**.

## Flow

1. Sender and recipient register accounts with their own country and phone number.
2. Sender looks up the recipient by registered phone number.
3. The server fetches an exchange rate and calculates amount, fee, and destination amount.
4. Sender reviews the quote and explicitly confirms it.
5. The server persists a transfer and its initial `SENT` event, then requests an SMS.
6. The recipient dashboard polls persisted transfers/events; a basic USSD service can check transfers and request a replacement code.
7. Store-agent endpoints record `IN_TRANSIT` and `READY_TO_COLLECT`; verified collection records `COLLECTED`.

## Configure

Copy `.env.example` to `.env.local`, supply a PostgreSQL `DATABASE_URL`, and configure the transfer currencies, fee basis points, and collection location. Senda does not seed demo accounts or use an in-memory runtime database. Create sender/recipient accounts through `/register`.

The existing `users.balance_cents` is checked and debited atomically when a sender confirms. New registrations start with a zero balance; this prototype does not include a card/bank funding integration, so a funded account must be provisioned through an approved payment source before it can send. Do not credit balances from client input.

Set `COLLECTION_CODE_SECRET` and `STORE_AGENT_SECRET` to unique random secrets. For carrier SMS, set all three Twilio variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM`. Without provider credentials, development records `SMS_REQUESTED`; it does not report successful delivery. SMS events store safe provider status/metadata, not message bodies or collection codes.

`EXCHANGE_RATE_API_URL` must be an API endpoint that returns a successful JSON document with a `rates` object keyed by destination currency. Database migrations are applied from `supabase/schema.sql` at runtime.

The store screen at `/store` is a protected prototype terminal, not a live PEP/Shoprite POS integration. Retail payout requires a provider/partner integration before production use.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3847](http://localhost:3847). Run unit tests with:

```bash
npm test
```

## Boundaries

The USSD endpoint is a lightweight service boundary; it is not connected to a mobile-network USSD aggregator. Twilio `SMS_SENT` means the provider accepted the request, not that the handset confirmed delivery. Transfer/event APIs require a reachable PostgreSQL database; local API integration tests run only when `TRANSFER_TEST_DATABASE_URL` points at a dedicated disposable test database.
