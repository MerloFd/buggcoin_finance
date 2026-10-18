-- buggcoin — database schema (Task 13, step 3)
--
-- Run this once in the Supabase SQL Editor.
-- Mirrors the domain model in lib/store/types.ts. Money is numeric(14,2),
-- never float. Every table is scoped by user_id and protected by RLS.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Recurring types. The direction of every Recurring comes from here.
create table public.recurring_types (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  label       text not null,
  direction   text not null check (direction in ('in', 'out')),
  -- The seeded 'gasto' type. Not deletable; exactly one per user.
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

create unique index recurring_types_one_default_per_user
  on public.recurring_types (user_id)
  where is_default;

-- Savings goals. Progress is derived from the plans pointing here, never stored.
create table public.goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  title          text not null,
  target_amount  numeric(14, 2) not null check (target_amount > 0),
  target_date    date,
  done_at        date,
  created_at     timestamptz not null default now()
);

-- Recurrings: monthly/yearly forecasts. An installment plan ("12x") is just a
-- recurring with end_kind = 'after'.
create table public.recurrings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  description      text not null,
  amount           numeric(14, 2) not null check (amount > 0),
  -- restrict: a type in use cannot be deleted.
  type_id          uuid not null references public.recurring_types (id) on delete restrict,
  category         text,
  url              text,
  priority         smallint not null default 3 check (priority between 1 and 5),
  -- Paused by the user. Different from "ended" (see end_kind).
  active           boolean not null default true,
  frequency        text not null default 'monthly' check (frequency in ('monthly', 'yearly')),
  -- Anchor: the day of month (and month, when yearly) is derived from this.
  start_date       date not null,
  end_kind         text not null default 'never' check (end_kind in ('never', 'after', 'on')),
  end_occurrences  integer check (end_occurrences > 0),
  end_date         date,
  created_at       timestamptz not null default now(),

  -- Only the column matching end_kind may be filled. Makes the invalid
  -- combinations unrepresentable at the database level, not just in the app.
  constraint recurrings_end_shape check (
    (end_kind = 'never' and end_occurrences is null and end_date is null)
    or (end_kind = 'after' and end_occurrences is not null and end_date is null)
    or (end_kind = 'on' and end_date is not null and end_occurrences is null)
  )
);

-- Entries: real money that moved (manual or imported from the bank).
create table public.entries (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  description            text not null,
  amount                 numeric(14, 2) not null check (amount > 0),
  date                   date not null,
  created_at             timestamptz not null default now(),
  direction              text not null check (direction in ('in', 'out')),
  category               text,
  source                 text not null check (source in ('manual', 'bank')),
  bank_transaction_id    text,
  -- null = not a duplicate. Own column, never a sentinel inside an id.
  dedup_status           text check (dedup_status in ('pending', 'merged', 'rejected')),
  dedup_partner_id       uuid references public.entries (id) on delete set null,
  realizes_recurring_id  uuid references public.recurrings (id) on delete set null,

  constraint entries_bank_needs_tx_id check (
    source = 'manual' or bank_transaction_id is not null
  )
);

-- Idempotency: re-fetching the bank updates the row instead of duplicating it.
create unique index entries_bank_transaction_unique
  on public.entries (user_id, bank_transaction_id)
  where bank_transaction_id is not null;

-- A recurring fulfilled (or assumed) in a given month.
create table public.recurring_realizations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  recurring_id  uuid not null references public.recurrings (id) on delete cascade,
  month         text not null check (month ~ '^\d{4}-\d{2}$'),
  status        text not null check (status in ('pending', 'confirmed', 'assumed')),
  entry_id      uuid references public.entries (id) on delete set null,
  created_at    timestamptz not null default now(),

  -- One realization per recurring per month.
  unique (recurring_id, month),

  -- 'assumed' means the month rolled over with no real entry; the other two
  -- only exist because an entry matched.
  constraint realizations_entry_shape check (
    (status = 'assumed' and entry_id is null)
    or (status in ('pending', 'confirmed') and entry_id is not null)
  )
);

-- Cost-cutting plans. Deleting the targeted recurring removes the plan with it.
create table public.plans (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  title                text not null,
  target_recurring_id  uuid not null references public.recurrings (id) on delete cascade,
  monthly_saving       numeric(14, 2) not null check (monthly_saving >= 0),
  goal_id              uuid references public.goals (id) on delete set null,
  -- null = not done yet. Replaces a boolean: the date is what lets the goal
  -- progress be derived.
  done_at              date,
  created_at           timestamptz not null default now()
);

create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);

-- Pluggy connection. One per user, so user_id is the primary key.
create table public.bank_connections (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  item_id     text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes for the queries the app actually makes
-- ---------------------------------------------------------------------------

create index entries_user_date_idx on public.entries (user_id, date desc);
create index recurrings_user_active_idx on public.recurrings (user_id, active);
create index realizations_user_month_idx on public.recurring_realizations (user_id, month);
create index plans_user_idx on public.plans (user_id);
create index notes_user_created_idx on public.notes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Without this, anyone holding the (public) anon key could read every user's
-- data. Each policy restricts both reads and writes to the signed-in user.
-- ---------------------------------------------------------------------------

alter table public.recurring_types        enable row level security;
alter table public.goals                  enable row level security;
alter table public.recurrings             enable row level security;
alter table public.entries                enable row level security;
alter table public.recurring_realizations enable row level security;
alter table public.plans                  enable row level security;
alter table public.notes                  enable row level security;
alter table public.bank_connections       enable row level security;

create policy "own rows" on public.recurring_types
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.recurrings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.recurring_realizations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.bank_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Seed the default recurring type on sign-up
--
-- Every user needs the non-deletable 'gasto' type to exist before creating a
-- recurring. Doing it here means it can never be missing.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.recurring_types (user_id, label, direction, is_default)
  values (new.id, 'gasto', 'out', true);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
