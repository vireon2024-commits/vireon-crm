from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
app = (ROOT / 'site/app.js').read_text()
css = (ROOT / 'site/styles.css').read_text()
sql = (ROOT / 'supabase/FINAL_SETUP.sql').read_text()
script = (ROOT / 'google-apps-script/Code.gs').read_text()
html = (ROOT / 'site/index.html').read_text()
netlify = (ROOT / 'netlify.toml').read_text()
sw = (ROOT / 'site/sw.js').read_text()

# Final identity and no browser-only/demo data fallback.
assert "const APP_VERSION = '1.0.0-final'" in app
assert "const SESSION_KEY = 'vireon-lead-hub-session-v1'" in app
assert "vireon-lead-hub-v1.0.0-final" in sw
assert "No demo records are shown" in app
assert 'localStorage' in app and 'SESSION_KEY' in app
assert 'service-secret' not in app
assert 'sheet-secret' not in app

# Front-end safety and interaction behaviour.
assert 'function safeUrl' in app
assert 'onclick=' not in app.lower()
assert "element.matches('input[data-action], select[data-action], textarea[data-action]')" in app
assert 'function csvCell' in app and "^[=+\\-@]" in app
assert 'Content-Security-Policy' in netlify
assert "frame-ancestors 'none'" in netlify
assert '<script src="/app.js" defer></script>' in html

# Vireon-only visual system and the pipeline background regression.
assert 'prefers-reduced-motion' in css
assert '.stage-row {' in css
stage_rule = re.search(r'\.stage-row\s*\{([^}]*)\}', css, re.S).group(1)
assert 'background' not in stage_rule.lower(), 'Pipeline dashboard rows must not have the old pale-blue block background.'
assert '#2563EB' in css and '#0B0B0B' in css and '#F5F3EF' in css

# Role separation, RLS and admin-only destructive/financial controls.
assert "'member'::public.user_role" in sql
assert "case when exists(select 1 from public.profiles where role='admin')" not in sql
assert "create policy client_financials_admin" in sql
assert "create policy profiles_admin_all" in sql
assert "create policy clients_update_admin" in sql
assert "create policy leads_select on public.leads for select to authenticated using (public.can_access_lead(id))" in sql
assert "exists(select 1 from public.tasks where lead_id=target_id and assigned_to=auth.uid())" in sql
assert "public.is_client_manager(client_id)" in sql
assert "revoke all on all tables in schema public from anon" in sql
assert "No lead/client demo records are inserted" in sql
for action in ['lead-delete', 'client-delete', 'task-delete', 'deliverable-delete', 'shoot-delete', 'payment-delete', 'reply-delete']:
    assert action in app

# Server-only account management and Sheets bridge.
assert "SUPABASE_SECRET_KEY" in app
assert 'findHeaderRow_' in script and "header row detected" in script.lower()
assert "'CRM ID'" in script
assert 'prepareNewRow_' in script
assert 'copyFormatToRange' in script
assert 'sheet.clear' not in script.lower()
assert 'clearContents' not in script

print('static.test.py: all assertions passed')
