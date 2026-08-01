-- Vireon CRM Phase 1 + Client Delivery Workspace
-- Run this once in a new Supabase project's SQL Editor.

create extension if not exists pgcrypto;

create type public.user_role as enum ('admin','member');
create type public.lead_stage as enum ('new','contacted','requirements','proposal_preparing','proposal_sent','follow_up','meeting','negotiating','won','lost','on_hold');
create type public.crm_priority as enum ('urgent','high','medium','low');
create type public.activity_type as enum ('call','whatsapp','email','physical_meeting','online_meeting','proposal','follow_up','payment','internal_note','stage_change');
create type public.task_status as enum ('pending','completed','cancelled');
create type public.client_status as enum ('active','paused','completed','cancelled');
create type public.deliverable_status as enum ('not_started','in_progress','review','approved','delivered','blocked');
create type public.payment_status as enum ('upcoming','due','overdue','paid','waived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Team Member',
  email text,
  role public.user_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
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
  last_activity_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_requirements (
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

create table public.clients (
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
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
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

create table public.tasks (
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

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
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
  updated_at timestamptz not null default now()
);

create table public.payments (
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

create table public.quick_replies (
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

create table public.stale_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stage public.lead_stage,
  inactivity_days int not null,
  condition_key text not null,
  suggested_action text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.sheet_integrations (
  id uuid primary key default gen_random_uuid(),
  sheet_name text,
  spreadsheet_id text,
  last_sync_at timestamptz,
  last_sync_direction text,
  last_sync_status text,
  last_sync_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  direction text not null,
  status text not null,
  imported_count int not null default 0,
  skipped_count int not null default 0,
  conflict_count int not null default 0,
  details jsonb not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  candidate_lead_id uuid references public.leads(id) on delete cascade,
  confidence int not null default 0,
  reasons text[] not null default '{}',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index leads_stage_idx on public.leads(stage);
create index leads_follow_up_idx on public.leads(next_follow_up_at);
create index leads_company_idx on public.leads(lower(company_name));
create index activities_lead_idx on public.activities(lead_id, created_at desc);
create index activities_client_idx on public.activities(client_id, created_at desc);
create index tasks_due_idx on public.tasks(status, due_at);
create index deliverables_client_idx on public.deliverables(client_id, due_date);
create index payments_client_idx on public.payments(client_id, due_date);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger leads_updated before update on public.leads for each row execute function public.set_updated_at();
create trigger requirements_updated before update on public.lead_requirements for each row execute function public.set_updated_at();
create trigger clients_updated before update on public.clients for each row execute function public.set_updated_at();
create trigger deliverables_updated before update on public.deliverables for each row execute function public.set_updated_at();
create trigger payments_updated before update on public.payments for each row execute function public.set_updated_at();
create trigger quick_replies_updated before update on public.quick_replies for each row execute function public.set_updated_at();
create trigger sheet_integrations_updated before update on public.sheet_integrations for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email, role)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email, 'member')
  on conflict(id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.stale_rules(name,stage,inactivity_days,condition_key,suggested_action) values
('Proposal awaiting response','proposal_sent',5,'proposal_no_activity','Send a proposal follow-up and ask for a decision timeline.'),
('Client reviewing',null,7,'remarks_waiting_review','Ask whether questions or revisions are needed.'),
('Meeting without proposal','meeting',2,'meeting_no_proposal','Prepare and send the proposal.'),
('Requirements not progressed','requirements',2,'requirements_no_progress','Begin proposal preparation.'),
('General inactive lead',null,10,'active_no_activity','Contact the client or move the lead to On Hold/Lost.');

insert into public.quick_replies(title,category,message_body,language,is_favorite) values
('Request requirements','Requirements Request','Could you please share your required number of videos, photos, shoot frequency, posting needs, overall expectations, and approximate budget? This will help us prepare a suitable package for {{company_name}}.','English',true),
('Proposal sent','Proposal Sent','It was a pleasure speaking with you. We have shared the proposal for {{company_name}}. Please review it and let us know a convenient time to discuss it further.','English',true),
('Gentle follow-up','Follow-up','Hello {{contact_name}}, I wanted to follow up regarding the proposal shared for {{company_name}}. Please let us know if you have any questions or would like any revisions.','English',false);

-- Internal team app: all authenticated users can work with CRM records.
-- Admin/member UI permissions can be tightened later without changing the data model.
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.lead_requirements enable row level security;
alter table public.clients enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.deliverables enable row level security;
alter table public.payments enable row level security;
alter table public.quick_replies enable row level security;
alter table public.stale_rules enable row level security;
alter table public.sheet_integrations enable row level security;
alter table public.sync_logs enable row level security;
alter table public.duplicate_candidates enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','leads','lead_requirements','clients','activities','tasks','deliverables','payments','quick_replies','stale_rules','sheet_integrations','sync_logs','duplicate_candidates'] loop
    execute format('create policy "authenticated_select_%1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "authenticated_insert_%1$s" on public.%1$I for insert to authenticated with check (true)', t);
    execute format('create policy "authenticated_update_%1$s" on public.%1$I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "authenticated_delete_%1$s" on public.%1$I for delete to authenticated using (true)', t);
  end loop;
end $$;
