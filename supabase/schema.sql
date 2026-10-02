-- Mukuru Home ledger. Runs on Postgres, including a Supabase project.
-- The app also creates these tables on startup.

create table if not exists users (
  id text primary key,
  role text not null check (role in ('sender', 'receiver')),
  name text not null,
  phone text not null unique,
  phone_number text,
  password_hash text not null,
  city text not null,
  country text,
  lang text not null default 'en' check (lang in ('en', 'sn')),
  preferred_language text,
  card_last4 text,
  balance_cents integer not null default 0,
  pin_misses integer not null default 0,
  id_masked text
);

create table if not exists sessions (
  token_hash text primary key,
  user_id text not null references users (id),
  expires_at bigint not null
);

create table if not exists quotes (
  id text primary key,
  sender_id text not null references users (id),
  amount_cents integer not null,
  fee_cents integer not null,
  net_cents integer not null,
  usd_cents integer not null,
  mid_usd_cents integer not null,
  rate_milli integer not null,
  mid_milli integer not null,
  payout text not null,
  created_at bigint not null,
  locked_until bigint not null,
  consumed_by text
);

create table if not exists orders (
  ref text primary key,
  sender_id text not null references users (id),
  receiver_id text not null references users (id),
  idempotency_key text not null unique,
  quote_id text not null,
  amount_cents integer not null,
  fee_cents integer not null,
  net_cents integer not null,
  usd_cents integer not null,
  rate_milli integer not null,
  payout text not null,
  pay_with text not null,
  status text not null,
  created_at bigint not null,
  paid_at bigint,
  voucher_at bigint,
  collected_at bigint,
  recipient_name text not null
);

create table if not exists ussd_sessions (
  id text primary key,
  user_id text references users (id),
  step text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at bigint not null
);

create table if not exists collection_codes (
  order_ref text primary key references orders (ref),
  receiver_id text not null references users (id),
  code_hash text not null,
  expires_at bigint not null,
  used_at bigint
);

create table if not exists sms_messages (
  id text primary key,
  receiver_id text not null references users (id),
  phone text not null,
  body text not null,
  delivery_status text not null,
  provider_id text,
  created_at bigint not null
);

alter table users add column if not exists country text;
alter table users add column if not exists preferred_language text;
alter table users add column if not exists phone_number text;
update users set phone_number = phone where phone_number is null;
create unique index if not exists users_phone_number_unique on users (phone_number);

create table if not exists transfer_quotes (
  id text primary key,
  sender_id text not null references users (id),
  recipient_id text not null references users (id),
  amount_minor bigint not null check (amount_minor > 0),
  source_currency char(3) not null,
  destination_currency char(3) not null,
  destination_amount_minor bigint not null check (destination_amount_minor > 0),
  exchange_rate numeric(18, 8) not null check (exchange_rate > 0),
  fee_minor bigint not null default 0 check (fee_minor >= 0),
  collection_location text not null,
  expires_at bigint not null,
  consumed_by text,
  created_at bigint not null
);

create table if not exists transfers (
  id text primary key,
  idempotency_key text not null unique,
  sender_id text not null references users (id),
  recipient_id text not null references users (id),
  amount_minor bigint not null check (amount_minor > 0),
  source_currency char(3) not null,
  destination_currency char(3) not null,
  destination_amount_minor bigint not null check (destination_amount_minor > 0),
  exchange_rate numeric(18, 8) not null check (exchange_rate > 0),
  fee_minor bigint not null default 0 check (fee_minor >= 0),
  collection_location text not null,
  collection_code_hash text not null,
  collection_code_expires_at bigint not null,
  status text not null check (status in ('SENT', 'IN_TRANSIT', 'READY_TO_COLLECT', 'COLLECTED')),
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists transfers_sender_created_idx on transfers (sender_id, created_at desc);
create index if not exists transfers_recipient_created_idx on transfers (recipient_id, created_at desc);
create unique index if not exists transfers_collection_code_hash_unique on transfers (collection_code_hash);

create table if not exists transfer_events (
  id text primary key,
  transfer_id text not null references transfers (id),
  status text not null check (status in ('SENT', 'IN_TRANSIT', 'READY_TO_COLLECT', 'COLLECTED')),
  actor_id text references users (id),
  created_at bigint not null
);

create index if not exists transfer_events_transfer_created_idx on transfer_events (transfer_id, created_at asc);

create table if not exists sms_delivery_events (
  id text primary key,
  transfer_id text not null references transfers (id),
  status text not null check (status in ('SMS_REQUESTED', 'SMS_SENT', 'SMS_FAILED')),
  provider text not null,
  provider_message_id text,
  safe_response jsonb,
  created_at bigint not null
);

create index if not exists sms_transfer_created_idx on sms_delivery_events (transfer_id, created_at desc);
