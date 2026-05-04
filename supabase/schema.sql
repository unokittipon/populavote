-- Run this in Supabase → SQL Editor

-- Candidates people vote for
create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  display_order int default 0,
  created_at timestamptz default now()
);

-- Each payment attempt (created when user starts the flow)
create table if not exists payment_intents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete restrict not null,
  amount_baht integer not null check (amount_baht >= 10 and amount_baht <= 100000),
  reference_number text unique not null,
  status text not null default 'pending' check (status in ('pending','verified','rejected','expired')),
  slip_trans_ref text unique,
  created_at timestamptz default now(),
  verified_at timestamptz
);

-- Vote ledger (1 row per 10฿ paid)
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete restrict not null,
  payment_intent_id uuid references payment_intents(id) on delete restrict not null,
  created_at timestamptz default now()
);

create index if not exists votes_candidate_idx on votes(candidate_id);
create index if not exists payment_intents_status_idx on payment_intents(status);

-- Live results view (sorted leaderboard)
create or replace view leaderboard as
select
  c.id,
  c.name,
  c.description,
  c.image_url,
  c.display_order,
  count(v.id)::int as points,
  coalesce(sum(case when v.id is not null then 10 else 0 end), 0)::int as baht_raised
from candidates c
left join votes v on v.candidate_id = c.id
group by c.id
order by points desc, c.display_order asc;

-- Row Level Security: lock down everything by default
alter table candidates enable row level security;
alter table payment_intents enable row level security;
alter table votes enable row level security;

-- Public can read candidates (for vote page)
drop policy if exists "candidates_public_read" on candidates;
create policy "candidates_public_read" on candidates for select using (true);

-- Nothing else is publicly accessible — service_role bypasses RLS for server routes
