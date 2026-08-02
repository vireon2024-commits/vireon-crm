-- VIREON LEAD HUB — FINAL DATABASE SETUP
-- Safe to run on a new Supabase project or over the earlier Vireon CRM schema.
-- It preserves existing records and upgrades security, roles, Sheets sync metadata,
-- client delivery cycles, shoots, audit history and admin-only finances.

create extension if not exists pgcrypto;

do $$ begin create type public.user_role as enum ('admin','member'); exception when duplicate_object then null; end $$;
do $$ begin create type public.lead_stage as enum ('new','contacted','requirements','proposal_preparing','proposal_sent','follow_up','meeting','negotiating','won','lost','on_hold'); exception when duplicate_object then null; end $$;
do $$ begin create type public.crm_priority as enum ('urgent','high','medium','low'); exception when duplicate_object then null; end $$;
do $$ begin create type public.activity_type as enum ('call','whatsapp','email','physical_meeting','online_meeting','proposal','follow_up','payment','internal_note','stage_change'); exception when duplicate_object then null; end $$;
do $$ begin create type public.task_status as enum ('pending','completed','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.client_status as enum ('active','paused','completed','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.deliverable_status as enum ('not_started','in_progress','review','approved','delivered','blocked'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('upcoming','due','overdue','paid','waived'); exception when duplicate_object then null; end $$;
do $$ begin create type public.cycle_status as enum ('planned','active','review','completed','paused'); exception when duplicate_object then null; end $$;
do $$ begin create type public.shoot_status as enum ('planned','confirmed','completed','cancelled','rescheduled'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Team Member',
  email text,
  role public.user_role not null default 'member',
  is_active boolean not null default true,
  job_title text,
  phone text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles add column if not exists job_title text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists last_seen_at timestamptz;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_person text,
  phone text,
  whatsapp text,
  email text,
  industry text,
  lead_source text,
  address text,
  website text,
  instagram text,
  facebook text,
  tiktok text,
  date_first_contacted timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  stage public.lead_stage not null default 'new',
  priority public.crm_priority not null default 'medium',
  estimated_budget numeric(12,2),
  expected_monthly_value numeric(12,2),
  closing_probability int check (closing_probability between 0 and 100),
  remarks text,
  next_follow_up_at timestamptz,
  next_follow_up_note text,
  proposal_url text,
  drive_folder_url text,
  decision_maker_contacted boolean not null default false,
  meeting_interest int not null default 0 check (meeting_interest between 0 and 5),
  urgency_level int not null default 0 check (urgency_level between 0 and 5),
  engagement_level int not null default 0 check (engagement_level between 0 and 5),
  requirements_completeness int not null default 0 check (requirements_completeness between 0 and 100),
  score int not null default 0 check (score between 0 and 100),
  score_override int check (score_override between 0 and 100),
  score_override_reason text,
  stale_reason text,
  sheet_status_text text,
  sheet_row_number int,
  sheet_last_synced_at timestamptz,
  last_activity_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.leads add column if not exists next_follow_up_note text;
alter table public.leads add column if not exists sheet_status_text text;
alter table public.leads add column if not exists sheet_row_number int;
alter table public.leads add column if not exists sheet_last_synced_at timestamptz;

create table if not exists public.lead_requirements (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  monthly_videos int not null default 0,
  monthly_graphics int not null default 0,
  shoot_frequency text,
  posting_requirements text,
  models_required boolean not null default false,
  voiceover_required boolean not null default false,
  video_editing_required boolean not null default false,
  content_creator_required boolean not null default false,
  social_media_handling_required boolean not null default false,
  approximate_budget numeric(12,2),
  special_expectations text,
  competitor_references text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid unique references public.leads(id) on delete set null,
  company_name text not null,
  contact_person text,
  phone text,
  email text,
  industry text,
  status public.client_status not null default 'active',
  package_name text,
  monthly_fee numeric(12,2) not null default 0,
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly','quarterly','one_time')),
  contract_start date,
  contract_end date,
  renewal_date date,
  account_manager uuid references public.profiles(id) on delete set null,
  scope_summary text,
  services text[] not null default '{}',
  approval_contact text,
  drive_folder_url text,
  contract_url text,
  notes text,
  next_shoot_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.clients add column if not exists next_shoot_at timestamptz;

-- Sensitive client amounts are stored separately and are administrator-only.
create table if not exists public.client_financials (
  client_id uuid primary key references public.clients(id) on delete cascade,
  monthly_fee numeric(12,2) not null default 0,
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly','quarterly','one_time')),
  payment_terms text,
  discount_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.client_financials (client_id, monthly_fee, billing_cycle)
select id, coalesce(monthly_fee,0), coalesce(billing_cycle,'monthly') from public.clients
on conflict (client_id) do update
set monthly_fee = case
      when public.client_financials.monthly_fee = 0 and excluded.monthly_fee <> 0 then excluded.monthly_fee
      else public.client_financials.monthly_fee
    end,
    billing_cycle = case
      when public.client_financials.billing_cycle = 'monthly' and excluded.billing_cycle <> 'monthly' then excluded.billing_cycle
      else public.client_financials.billing_cycle
    end;
-- Remove sensitive legacy values from the member-readable clients table only after copying them.
update public.clients set monthly_fee = 0 where monthly_fee <> 0;

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  type public.activity_type not null default 'internal_note',
  summary text not null,
  details text,
  client_response text,
  next_action text,
  next_follow_up_at timestamptz,
  external_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (lead_id is not null or client_id is not null or type = 'internal_note')
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  status public.task_status not null default 'pending',
  priority public.crm_priority not null default 'medium',
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.client_cycles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  label text not null,
  period_start date not null,
  period_end date not null,
  status public.cycle_status not null default 'planned',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.deliverables (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  cycle_id uuid references public.client_cycles(id) on delete set null,
  title text not null,
  category text not null default 'Content',
  period_label text,
  quantity int not null default 1 check (quantity > 0),
  completed_quantity int not null default 0 check (completed_quantity >= 0),
  status public.deliverable_status not null default 'not_started',
  due_date date,
  assigned_to uuid references public.profiles(id) on delete set null,
  approval_status text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_quantity <= quantity)
);
alter table public.deliverables add column if not exists cycle_id uuid references public.client_cycles(id) on delete set null;

create table if not exists public.shoots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  cycle_id uuid references public.client_cycles(id) on delete set null,
  title text not null default 'Content shoot',
  scheduled_at timestamptz not null,
  duration_minutes int,
  location text,
  status public.shoot_status not null default 'planned',
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null default 0,
  due_date date,
  paid_at timestamptz,
  status public.payment_status not null default 'upcoming',
  payment_method text,
  invoice_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'General',
  message_body text not null,
  language text not null default 'English',
  tags text[] not null default '{}',
  is_favorite boolean not null default false,
  is_archived boolean not null default false,
  usage_count int not null default 0,
  last_used_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stale_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stage public.lead_stage,
  inactivity_days int not null,
  condition_key text not null,
  suggested_action text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sheet_integrations (
  id uuid primary key default gen_random_uuid(),
  sheet_name text,
  spreadsheet_id text,
  header_row int,
  last_sync_at timestamptz,
  last_sync_direction text,
  last_sync_status text,
  last_sync_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sheet_integrations add column if not exists header_row int;

create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  direction text not null,
  status text not null,
  imported_count int not null default 0,
  updated_count int not null default 0,
  skipped_count int not null default 0,
  conflict_count int not null default 0,
  details jsonb not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.sync_logs add column if not exists updated_count int not null default 0;

create table if not exists public.duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  candidate_lead_id uuid references public.leads(id) on delete cascade,
  confidence int not null default 0,
  reasons text[] not null default '{}',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists leads_stage_idx on public.leads(stage);
create index if not exists leads_follow_up_idx on public.leads(next_follow_up_at);
create index if not exists leads_company_idx on public.leads(lower(company_name));
create index if not exists leads_phone_idx on public.leads(phone);
create index if not exists leads_sheet_row_idx on public.leads(sheet_row_number);
create index if not exists activities_lead_idx on public.activities(lead_id, created_at desc);
create index if not exists activities_client_idx on public.activities(client_id, created_at desc);
create index if not exists tasks_due_idx on public.tasks(status, due_at);
create index if not exists client_cycles_period_idx on public.client_cycles(client_id, period_start desc);
create index if not exists deliverables_client_idx on public.deliverables(client_id, due_date);
create index if not exists shoots_schedule_idx on public.shoots(scheduled_at);
create index if not exists payments_client_idx on public.payments(client_id, due_date);

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- Recreate update triggers idempotently.
do $$
declare t text;
begin
  foreach t in array array['profiles','leads','lead_requirements','clients','client_financials','client_cycles','deliverables','shoots','payments','quick_replies','sheet_integrations'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated', t);
  end loop;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,'Team Member'),'@',1)),
    new.email,
    'member'::public.user_role
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Backfill profiles for auth users created before this migration.
insert into public.profiles (id, full_name, email, role)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', split_part(coalesce(u.email,'Team Member'),'@',1)), u.email,
       'member'::public.user_role
from auth.users u
where not exists(select 1 from public.profiles p where p.id=u.id)
on conflict do nothing;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id=auth.uid() and is_active=true);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active=true);
$$;

create or replace function public.can_access_lead(target_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or (
    public.is_active_user() and (
      exists(select 1 from public.leads where id=target_id and (assigned_to=auth.uid() or created_by=auth.uid()))
      or exists(select 1 from public.tasks where lead_id=target_id and assigned_to=auth.uid())
    )
  );
$$;

create or replace function public.is_client_manager(target_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or (
    public.is_active_user() and exists(
      select 1 from public.clients c left join public.leads l on l.id=c.lead_id
      where c.id=target_id and (c.account_manager=auth.uid() or l.assigned_to=auth.uid())
    )
  );
$$;

create or replace function public.can_access_client(target_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or (
    public.is_active_user() and (
      exists(
        select 1 from public.clients c left join public.leads l on l.id=c.lead_id
        where c.id=target_id and (c.account_manager=auth.uid() or c.created_by=auth.uid() or l.assigned_to=auth.uid())
      )
      or exists(select 1 from public.tasks where client_id=target_id and assigned_to=auth.uid())
      or exists(select 1 from public.deliverables where client_id=target_id and assigned_to=auth.uid())
      or exists(select 1 from public.shoots where client_id=target_id and assigned_to=auth.uid())
    )
  );
$$;

-- Audit important changes. Values are retained only for administrators.
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
  values(auth.uid(), tg_op, tg_table_name,
    coalesce((case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id',''),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','leads','lead_requirements','clients','client_financials','tasks','client_cycles','deliverables','shoots','payments','quick_replies'] loop
    execute format('drop trigger if exists %I on public.%I', 'audit_' || t, t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', 'audit_' || t, t);
  end loop;
end $$;

-- Row Level Security.
do $$
declare t text;
begin
  foreach t in array array['profiles','leads','lead_requirements','clients','client_financials','activities','tasks','client_cycles','deliverables','shoots','payments','quick_replies','stale_rules','sheet_integrations','sync_logs','duplicate_candidates','audit_logs'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

-- Remove all previous policies on Vireon tables, then add final policies.
do $$
declare p record;
begin
  for p in select schemaname,tablename,policyname from pg_policies
    where schemaname='public' and tablename=any(array['profiles','leads','lead_requirements','clients','client_financials','activities','tasks','client_cycles','deliverables','shoots','payments','quick_replies','stale_rules','sheet_integrations','sync_logs','duplicate_candidates','audit_logs'])
  loop execute format('drop policy if exists %I on %I.%I',p.policyname,p.schemaname,p.tablename); end loop;
end $$;

create policy profiles_select on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin() or (public.is_active_user() and is_active=true));
create policy profiles_admin_all on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy leads_select on public.leads for select to authenticated using (public.can_access_lead(id));
create policy leads_insert_admin on public.leads for insert to authenticated with check (public.is_admin());
create policy leads_update on public.leads for update to authenticated using (public.is_admin() or (public.is_active_user() and (assigned_to=auth.uid() or created_by=auth.uid()))) with check (public.is_admin() or (public.is_active_user() and (assigned_to=auth.uid() or created_by=auth.uid())));
create policy leads_delete_admin on public.leads for delete to authenticated using (public.is_admin());

create policy requirements_select on public.lead_requirements for select to authenticated using (public.can_access_lead(lead_id));
create policy requirements_insert on public.lead_requirements for insert to authenticated with check (public.can_access_lead(lead_id));
create policy requirements_update on public.lead_requirements for update to authenticated using (public.can_access_lead(lead_id)) with check (public.can_access_lead(lead_id));
create policy requirements_delete_admin on public.lead_requirements for delete to authenticated using (public.is_admin());

create policy clients_select on public.clients for select to authenticated using (public.can_access_client(id));
create policy clients_insert_admin on public.clients for insert to authenticated with check (public.is_admin());
create policy clients_update_admin on public.clients for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy clients_delete_admin on public.clients for delete to authenticated using (public.is_admin());

create policy client_financials_admin on public.client_financials for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy activities_select on public.activities for select to authenticated using (
  public.is_admin() or created_by=auth.uid() or (lead_id is not null and public.can_access_lead(lead_id)) or (client_id is not null and public.can_access_client(client_id))
);
create policy activities_insert on public.activities for insert to authenticated with check (
  public.is_active_user() and created_by=auth.uid() and (public.is_admin() or (lead_id is not null and public.can_access_lead(lead_id)) or (client_id is not null and public.can_access_client(client_id)) or (lead_id is null and client_id is null and type='internal_note'))
);
create policy activities_admin_modify on public.activities for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy activities_admin_delete on public.activities for delete to authenticated using (public.is_admin());

create policy tasks_select on public.tasks for select to authenticated using (public.is_admin() or (public.is_active_user() and (assigned_to=auth.uid() or created_by=auth.uid())));
create policy tasks_insert on public.tasks for insert to authenticated with check (
  public.is_admin() or (
    public.is_active_user() and assigned_to=auth.uid() and created_by=auth.uid()
    and (lead_id is null or public.can_access_lead(lead_id))
    and (client_id is null or public.can_access_client(client_id))
  )
);
create policy tasks_update on public.tasks for update to authenticated using (public.is_admin() or (public.is_active_user() and assigned_to=auth.uid())) with check (public.is_admin() or (public.is_active_user() and assigned_to=auth.uid()));
create policy tasks_delete_admin on public.tasks for delete to authenticated using (public.is_admin());

create policy cycles_select on public.client_cycles for select to authenticated using (public.can_access_client(client_id));
create policy cycles_admin_modify on public.client_cycles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy deliverables_select on public.deliverables for select to authenticated using (public.is_admin() or (public.is_active_user() and (assigned_to=auth.uid() or public.can_access_client(client_id))));
create policy deliverables_insert_admin on public.deliverables for insert to authenticated with check (public.is_admin());
create policy deliverables_update on public.deliverables for update to authenticated using (public.is_admin() or (public.is_active_user() and (assigned_to=auth.uid() or public.is_client_manager(client_id)))) with check (public.is_admin() or (public.is_active_user() and (assigned_to=auth.uid() or public.is_client_manager(client_id))));
create policy deliverables_delete_admin on public.deliverables for delete to authenticated using (public.is_admin());

create policy shoots_select on public.shoots for select to authenticated using (public.is_admin() or (public.is_active_user() and (assigned_to=auth.uid() or public.can_access_client(client_id))));
create policy shoots_insert_admin on public.shoots for insert to authenticated with check (public.is_admin());
create policy shoots_update on public.shoots for update to authenticated using (public.is_admin() or (public.is_active_user() and (assigned_to=auth.uid() or public.is_client_manager(client_id)))) with check (public.is_admin() or (public.is_active_user() and (assigned_to=auth.uid() or public.is_client_manager(client_id))));
create policy shoots_delete_admin on public.shoots for delete to authenticated using (public.is_admin());

create policy payments_admin on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy quick_replies_select on public.quick_replies for select to authenticated using (public.is_active_user());
create policy quick_replies_admin on public.quick_replies for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy stale_rules_select on public.stale_rules for select to authenticated using (public.is_active_user());
create policy stale_rules_admin on public.stale_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy sheet_integrations_admin on public.sheet_integrations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy sync_logs_admin on public.sync_logs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy duplicates_admin on public.duplicate_candidates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy audit_admin on public.audit_logs for select to authenticated using (public.is_admin());

-- API privileges. Row Level Security remains the final authority for every request.
revoke create on schema public from public;
revoke create on schema public from anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Function permissions.
revoke all on function public.is_active_user() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.can_access_lead(uuid) from public;
revoke all on function public.is_client_manager(uuid) from public;
revoke all on function public.can_access_client(uuid) from public;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_access_lead(uuid) to authenticated;
grant execute on function public.is_client_manager(uuid) to authenticated;
grant execute on function public.can_access_client(uuid) to authenticated;

-- Default stale rules.
insert into public.stale_rules(name,stage,inactivity_days,condition_key,suggested_action)
select * from (values
  ('Proposal waiting','proposal_sent'::public.lead_stage,5,'proposal_waiting','Send a concise follow-up and ask when the proposal can be reviewed.'),
  ('Requirements stalled','requirements'::public.lead_stage,2,'requirements_stalled','Start proposal preparation and assign an owner.'),
  ('General inactive lead',null::public.lead_stage,10,'inactive','Contact the lead or move it to On Hold/Lost.')
) as v(name,stage,inactivity_days,condition_key,suggested_action)
where not exists(select 1 from public.stale_rules);

-- Useful Vireon quick replies. No lead/client demo records are inserted.
insert into public.quick_replies(title,category,message_body,language,is_favorite)
select * from (values
  ('Request requirements','Requirements Request','Hello {{contact_name}}, could you please share your required number of videos and photos, preferred shoot frequency, posting needs, overall expectations, and the approximate monthly budget allocated for content creation? This will help us prepare a suitable package for {{company_name}}. We can also schedule a short online meeting to discuss everything clearly.','English',true),
  ('Proposal sent','Proposal Sent','Hello {{contact_name}}, it was a pleasure speaking with you. As discussed, we have shared the proposal for {{company_name}}. Please review it and let us know a convenient time for a short online meeting so we can discuss the next steps.','English',true),
  ('Polite follow-up','Follow-up','Hello {{contact_name}}, I hope you are doing well. I wanted to follow up regarding the proposal shared with {{company_name}}. Please let us know if you have any questions or would like any changes. We would be happy to discuss it in a short meeting.','English',true),
  ('Thank you','Thank You','Thank you for the update. We appreciate your time and look forward to your response.','English',false),
  ('Meeting confirmation','Meeting Scheduling','Hello {{contact_name}}, thank you. Our meeting is confirmed for {{meeting_time}}. We look forward to discussing the content requirements and the most suitable way to work together.','English',false)
) as v(title,category,message_body,language,is_favorite)
where not exists(select 1 from public.quick_replies);

-- Ensure the oldest active account is an administrator if none exists.
update public.profiles set role='admin'
where id=(select id from public.profiles where is_active=true order by created_at asc limit 1)
  and not exists(select 1 from public.profiles where role='admin' and is_active=true);

-- Refresh PostgREST schema cache.
notify pgrst, 'reload schema';
