# Start Here

This is the complete final package. Do not install the earlier V2 zip first.

Use this order:

1. Back up the current Google Sheet and current Netlify deployment.
2. Replace the old app files in GitHub with this final package.
3. Run `supabase/FINAL_SETUP.sql`.
4. Confirm your personal Supabase login exists.
5. Edit and run `supabase/MAKE_ADMIN.sql`.
6. Add the required Netlify environment variables.
7. Paste and deploy `google-apps-script/Code.gs` from the existing leads Sheet.
8. Add its Web App URL to Netlify and redeploy.
9. Sign in as Administrator and test the Sheet connection.
10. Preview and import the current live Sheet rows.
11. Verify the totals, then create Team Member accounts and assign work.
12. Test one Team Member login in a private/incognito browser window.

The exact clicks and values are in `docs/SETUP-GUIDE.md`.

## Do not do these

- Do not put `SUPABASE_SECRET_KEY` in the frontend, GitHub, Apps Script or a screenshot.
- Do not run `OPTIONAL_CLEAN_START.sql` unless the existing CRM contains only disposable test records.
- Do not click **Sync CRM to Sheet** before reviewing the first Sheet import.
- Do not give staff the Administrator login.
