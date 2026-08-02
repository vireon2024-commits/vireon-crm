-- VIREON LEAD HUB — READ-ONLY SETUP VERIFICATION
-- Run after FINAL_SETUP.sql and MAKE_ADMIN.sql. This file changes nothing.

select
  to_regclass('public.profiles') is not null as profiles_ready,
  to_regclass('public.leads') is not null as leads_ready,
  to_regclass('public.clients') is not null as clients_ready,
  to_regclass('public.client_financials') is not null as private_finances_ready,
  to_regclass('public.client_cycles') is not null as cycles_ready,
  to_regclass('public.deliverables') is not null as deliverables_ready,
  to_regclass('public.shoots') is not null as shoots_ready,
  to_regclass('public.audit_logs') is not null as audit_ready;

select
  count(*) filter (where role='admin' and is_active=true) as active_admins,
  count(*) filter (where role='member' and is_active=true) as active_team_members,
  count(*) filter (where is_active=false) as inactive_accounts
from public.profiles;

select tablename, count(*) as policy_count
from pg_policies
where schemaname='public'
  and tablename = any(array[
    'profiles','leads','lead_requirements','clients','client_financials','activities',
    'tasks','client_cycles','deliverables','shoots','payments','quick_replies',
    'stale_rules','sheet_integrations','sync_logs','duplicate_candidates','audit_logs'
  ])
group by tablename
order by tablename;

select
  (select count(*) from public.leads) as lead_count,
  (select count(*) from public.clients) as client_count,
  (select count(*) from public.quick_replies) as quick_reply_count,
  (select count(*) from public.stale_rules where enabled=true) as enabled_stale_rules;
