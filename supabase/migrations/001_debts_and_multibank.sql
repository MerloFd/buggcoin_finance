-- Migration 001 — Debts (Task 14) + multiple bank connections
--
-- The base schema in supabase/schema.sql is ALREADY APPLIED. This file only
-- alters it. Run it once in the Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- 1. Creditor on recurrings
--
-- "Pra quem eu devo" needs its own field: `description` is the WHAT ("sofá"),
-- creditor is the WHO ("Magalu"). Without splitting them there is nothing to
-- group by.
-- ---------------------------------------------------------------------------

alter table public.recurrings
  add column if not exists creditor text;

-- ---------------------------------------------------------------------------
-- 2. Open debts
--
-- A debt with no fixed installments ("R$ 2.000 to my brother"). NOT a
-- recurring: there is no monthly charge, so modelling it as one would invent a
-- forecast expense that does not exist and skew "posso gastar".
--
-- The outstanding balance is derived (total - payments), never stored.
-- ---------------------------------------------------------------------------

create table if not exists public.debts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  creditor      text not null,
  description   text not null default '',
  total_amount  numeric(14, 2) not null check (total_amount > 0),
  due_date      date,
  settled_at    date,
  created_at    timestamptz not null default now()
);

create index if not exists debts_user_idx on public.debts (user_id);

alter table public.debts enable row level security;

drop policy if exists "own rows" on public.debts;
create policy "own rows" on public.debts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. Link a payment to an open debt
--
-- set null on delete: deleting the debt must not delete the expense — the money
-- did leave the account.
-- ---------------------------------------------------------------------------

alter table public.entries
  add column if not exists pays_debt_id uuid references public.debts (id) on delete set null;

create index if not exists entries_pays_debt_idx
  on public.entries (pays_debt_id)
  where pays_debt_id is not null;

-- ---------------------------------------------------------------------------
-- 4. More than one bank connection per user
--
-- The original table used user_id as the primary key, allowing a single
-- connection. Meu Pluggy (free tier) allows up to 5 connections for the same
-- account holder, so the key becomes (user_id, item_id).
-- ---------------------------------------------------------------------------

alter table public.bank_connections
  add column if not exists institution text;

alter table public.bank_connections
  drop constraint if exists bank_connections_pkey;

alter table public.bank_connections
  add constraint bank_connections_pkey primary key (user_id, item_id);
