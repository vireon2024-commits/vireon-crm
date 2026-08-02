-- OPTIONAL — CLEAN START BEFORE IMPORTING THE REAL GOOGLE SHEET
-- Run this only when the current CRM contains test/sample records that you no longer need.
-- It keeps login accounts, roles, Vireon quick replies and stale-lead rules.

begin;
truncate table
  public.duplicate_candidates,
  public.sync_logs,
  public.sheet_integrations,
  public.payments,
  public.shoots,
  public.deliverables,
  public.client_cycles,
  public.activities,
  public.tasks,
  public.client_financials,
  public.clients,
  public.lead_requirements,
  public.leads,
  public.audit_logs
restart identity cascade;
commit;
