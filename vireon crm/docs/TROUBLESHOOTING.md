# Troubleshooting

## The app says Supabase variables are missing

Confirm `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` exist in Netlify, then trigger a new deployment.

## Login works but the app asks for FINAL_SETUP.sql

Run the complete `supabase/FINAL_SETUP.sql` in the same Supabase project whose URL is stored in Netlify.

## MAKE_ADMIN.sql says no profile exists

Create the user under **Supabase → Authentication → Users**, then run `MAKE_ADMIN.sql` again.

## Team page says account management is not configured

Add `SUPABASE_SECRET_KEY` to Netlify and redeploy. The value should be the server-only Supabase secret key. A legacy `SUPABASE_SERVICE_ROLE_KEY` is accepted only as an alternative.

## Google Sheets test says unauthorized

`GOOGLE_SHEETS_SHARED_SECRET` in Netlify and `VIREON_SHARED_SECRET` in Apps Script must be exactly identical. Remove accidental spaces and redeploy Netlify.

## Google Sheets test cannot find the tab

Set the Apps Script property:

```text
VIREON_SHEET_NAME = leads new
```

Use the exact capitalization and spacing shown on the tab.

## Google Sheets test cannot find a spreadsheet

Set `VIREON_SPREADSHEET_ID` in Apps Script. Copy the value between `/d/` and `/edit` from the Sheet URL.

## Apps Script changes are not appearing

Saving the file is not enough. Open **Deploy → Manage deployments**, edit the Web App, choose **New version**, and deploy again.

## A lead appears twice

Open **Settings → Preview & import real data**. Exact CRM ID, phone and email matches update. A company with a different phone remains separate by design. For company-only rows, choose Review rather than automatically merging.

## A Team Member sees no data

Assign a lead, task, client account-manager role, deliverable or shoot to that profile from the Administrator workspace, then refresh.

## A Team Member cannot update a work item

The person must be assigned to that deliverable/shoot or be the client account manager/assigned lead owner.

## Old styling remains after deployment

Use a hard refresh (`Command + Shift + R`) and confirm Netlify published the latest GitHub commit. The service worker updates on reload.
