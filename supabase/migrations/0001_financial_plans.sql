-- financial_plans: one row per user's saved plan (spec.md §2.6).
-- v1 keeps only the single "current plan" per user — no history/versioning
-- (that's an explicit v2 item, see PRD.md §4).
--
-- intake_payload stores the full validated intake form (age, income, current
-- savings, goal, member type, risk answers, etc.) so a returning user's form
-- can be pre-filled for easy regeneration. result_payload stores the full
-- /api/plan response (SSS estimate, required savings, allocation, narrative,
-- levers, sources) so the saved plan can be re-rendered without recomputing.

create table if not exists public.financial_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  intake_payload jsonb not null,
  result_payload jsonb not null,
  risk_profile text not null check (risk_profile in ('conservative', 'moderate', 'aggressive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.financial_plans enable row level security;

-- RLS policies below control WHICH rows a role may touch, but Postgres still
-- requires this separate base-level grant before RLS is even evaluated.
-- Creating a table via the Supabase dashboard's table editor does this
-- automatically; a raw SQL migration (like this one) does not, and omitting
-- it causes a "permission denied for table financial_plans" error even
-- though the RLS policies below are otherwise correct.
grant select, insert, update, delete on public.financial_plans to authenticated;

create policy "Users can view their own plan"
  on public.financial_plans for select
  using (auth.uid() = user_id);

create policy "Users can insert their own plan"
  on public.financial_plans for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own plan"
  on public.financial_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own plan"
  on public.financial_plans for delete
  using (auth.uid() = user_id);

-- Keep updated_at current on every upsert.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger financial_plans_set_updated_at
  before update on public.financial_plans
  for each row
  execute function public.set_updated_at();
