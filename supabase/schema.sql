-- Mukuru Home ledger. Runs on Postgres, including a Supabase project.
-- The app also creates these tables on startup.

create table if not exists users (
  id text primary key,
  role text not null check (role in ('sender', 'receiver')),
  name text not null,
  phone text not null unique,
  password_hash text not null,
  city text not null,
  lang text not null default 'en' check (lang in ('en', 'sn')),
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
