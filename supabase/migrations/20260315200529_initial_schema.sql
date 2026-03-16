create extension if not exists pgcrypto;

create type public.membership_role as enum ('owner', 'manager', 'contractor');
create type public.project_status as enum ('active', 'archived');
create type public.timesheet_status as enum ('draft', 'submitted', 'approved', 'rejected');
create type public.time_entry_status as enum ('draft', 'submitted', 'approved', 'rejected');
create type public.entry_source as enum ('manual', 'timer', 'assistant');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
create type public.billing_provider as enum ('stripe', 'revenuecat');
create type public.approval_action as enum ('approved', 'rejected');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'Europe/Sarajevo',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null,
  hourly_rate_cents integer not null default 0,
  is_active boolean not null default true,
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  unique (organization_id, user_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  contact_email text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  code text,
  description text,
  budget_cents integer,
  hourly_rate_cents integer not null default 0,
  status public.project_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  is_billable boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.rate_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  hourly_rate_cents integer not null,
  effective_from date not null default current_date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (membership_id is not null or project_id is not null)
);

create table public.timesheets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  status public.timesheet_status not null default 'draft',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  rejection_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, user_id, week_start)
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  task_id uuid references public.tasks(id) on delete set null,
  timesheet_id uuid references public.timesheets(id) on delete set null,
  source public.entry_source not null default 'manual',
  status public.time_entry_status not null default 'draft',
  billable boolean not null default true,
  note text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  minutes integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ended_at > started_at),
  check (minutes > 0)
);

create table public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  task_id uuid references public.tasks(id) on delete set null,
  note text,
  billable boolean not null default true,
  started_at timestamptz not null,
  ended_at timestamptz,
  time_entry_id uuid references public.time_entries(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ended_at is null or ended_at > started_at)
);

create unique index work_sessions_one_active_per_user_org
  on public.work_sessions (organization_id, user_id)
  where ended_at is null;

create table public.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  timesheet_id uuid not null references public.timesheets(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  action public.approval_action not null,
  comment text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  provider public.billing_provider not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text,
  plan_code text not null default 'free',
  status public.subscription_status not null default 'trialing',
  seats integer not null default 1,
  trial_ends_at timestamptz,
  renews_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  enabled boolean not null default false,
  limit_value integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, code)
);

create or replace function public.current_user_role(target_org_id uuid)
returns public.membership_role
language sql
stable
as $$
  select membership.role
  from public.memberships membership
  where membership.organization_id = target_org_id
    and membership.user_id = auth.uid()
    and membership.deleted_at is null
  limit 1;
$$;

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.memberships membership
    where membership.organization_id = target_org_id
      and membership.user_id = auth.uid()
      and membership.deleted_at is null
  );
$$;

create or replace function public.is_org_manager(target_org_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(public.current_user_role(target_org_id) in ('owner', 'manager'), false);
$$;

create index memberships_org_user_idx on public.memberships (organization_id, user_id);
create index clients_org_idx on public.clients (organization_id);
create index projects_org_idx on public.projects (organization_id);
create index tasks_project_idx on public.tasks (project_id);
create index timesheets_org_user_idx on public.timesheets (organization_id, user_id, week_start);
create index time_entries_org_user_idx on public.time_entries (organization_id, user_id, started_at);
create index work_sessions_org_user_idx on public.work_sessions (organization_id, user_id, started_at);
create index approval_decisions_timesheet_idx on public.approval_decisions (timesheet_id);
create index audit_events_org_idx on public.audit_events (organization_id, created_at desc);

create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger set_memberships_updated_at
before update on public.memberships
for each row execute function public.set_updated_at();

create trigger set_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger set_rate_cards_updated_at
before update on public.rate_cards
for each row execute function public.set_updated_at();

create trigger set_timesheets_updated_at
before update on public.timesheets
for each row execute function public.set_updated_at();

create trigger set_time_entries_updated_at
before update on public.time_entries
for each row execute function public.set_updated_at();

create trigger set_work_sessions_updated_at
before update on public.work_sessions
for each row execute function public.set_updated_at();

create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create trigger set_entitlements_updated_at
before update on public.entitlements
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.rate_cards enable row level security;
alter table public.timesheets enable row level security;
alter table public.time_entries enable row level security;
alter table public.work_sessions enable row level security;
alter table public.approval_decisions enable row level security;
alter table public.audit_events enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlements enable row level security;

create policy "user can view own profile"
on public.user_profiles
for select
using (id = auth.uid());

create policy "user can update own profile"
on public.user_profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "org members can view organizations"
on public.organizations
for select
using (public.is_org_member(id));

create policy "owners can update organizations"
on public.organizations
for update
using (public.current_user_role(id) = 'owner')
with check (public.current_user_role(id) = 'owner');

create policy "members can view memberships"
on public.memberships
for select
using (public.is_org_member(organization_id));

create policy "managers can manage memberships"
on public.memberships
for all
using (public.is_org_manager(organization_id))
with check (public.is_org_manager(organization_id));

create policy "members can view clients"
on public.clients
for select
using (public.is_org_member(organization_id));

create policy "managers can manage clients"
on public.clients
for all
using (public.is_org_manager(organization_id))
with check (public.is_org_manager(organization_id));

create policy "members can view projects"
on public.projects
for select
using (public.is_org_member(organization_id));

create policy "managers can manage projects"
on public.projects
for all
using (public.is_org_manager(organization_id))
with check (public.is_org_manager(organization_id));

create policy "members can view tasks"
on public.tasks
for select
using (public.is_org_member(organization_id));

create policy "managers can manage tasks"
on public.tasks
for all
using (public.is_org_manager(organization_id))
with check (public.is_org_manager(organization_id));

create policy "members can view rate cards"
on public.rate_cards
for select
using (public.is_org_member(organization_id));

create policy "managers can manage rate cards"
on public.rate_cards
for all
using (public.is_org_manager(organization_id))
with check (public.is_org_manager(organization_id));

create policy "members can view timesheets"
on public.timesheets
for select
using (
  public.is_org_member(organization_id)
  and (
    user_id = auth.uid()
    or public.is_org_manager(organization_id)
  )
);

create policy "users can create own timesheets"
on public.timesheets
for insert
with check (
  public.is_org_member(organization_id)
  and user_id = auth.uid()
);

create policy "users or managers can update timesheets"
on public.timesheets
for update
using (
  public.is_org_member(organization_id)
  and (
    user_id = auth.uid()
    or public.is_org_manager(organization_id)
  )
)
with check (
  public.is_org_member(organization_id)
  and (
    user_id = auth.uid()
    or public.is_org_manager(organization_id)
  )
);

create policy "members can view time entries"
on public.time_entries
for select
using (
  public.is_org_member(organization_id)
  and (
    user_id = auth.uid()
    or public.is_org_manager(organization_id)
  )
);

create policy "users can create own time entries"
on public.time_entries
for insert
with check (
  public.is_org_member(organization_id)
  and user_id = auth.uid()
);

create policy "users or managers can update time entries"
on public.time_entries
for update
using (
  public.is_org_member(organization_id)
  and (
    user_id = auth.uid()
    or public.is_org_manager(organization_id)
  )
)
with check (
  public.is_org_member(organization_id)
  and (
    user_id = auth.uid()
    or public.is_org_manager(organization_id)
  )
);

create policy "members can view work sessions"
on public.work_sessions
for select
using (
  public.is_org_member(organization_id)
  and (
    user_id = auth.uid()
    or public.is_org_manager(organization_id)
  )
);

create policy "users can create own work sessions"
on public.work_sessions
for insert
with check (
  public.is_org_member(organization_id)
  and user_id = auth.uid()
);

create policy "users or managers can update work sessions"
on public.work_sessions
for update
using (
  public.is_org_member(organization_id)
  and (
    user_id = auth.uid()
    or public.is_org_manager(organization_id)
  )
)
with check (
  public.is_org_member(organization_id)
  and (
    user_id = auth.uid()
    or public.is_org_manager(organization_id)
  )
);

create policy "members can view approval decisions"
on public.approval_decisions
for select
using (public.is_org_member(organization_id));

create policy "managers can create approval decisions"
on public.approval_decisions
for insert
with check (
  public.is_org_manager(organization_id)
  and actor_user_id = auth.uid()
);

create policy "members can view audit events"
on public.audit_events
for select
using (public.is_org_member(organization_id));

create policy "members can create audit events"
on public.audit_events
for insert
with check (
  public.is_org_member(organization_id)
  and actor_user_id = auth.uid()
);

create policy "managers can view subscriptions"
on public.subscriptions
for select
using (public.is_org_manager(organization_id));

create policy "owners can manage subscriptions"
on public.subscriptions
for all
using (public.current_user_role(organization_id) = 'owner')
with check (public.current_user_role(organization_id) = 'owner');

create policy "members can view entitlements"
on public.entitlements
for select
using (public.is_org_member(organization_id));

create policy "owners can manage entitlements"
on public.entitlements
for all
using (public.current_user_role(organization_id) = 'owner')
with check (public.current_user_role(organization_id) = 'owner');
