# Vireon CRM

A no-build, dependency-free web app for Vireon's lead tracking, follow-ups, signed-client workspaces, deliverables, payments, Quick Replies, smart note parsing, lead scoring, stale-lead detection, duplicate warnings and Google Sheets backup.

## What is included

- Responsive dashboard for Mac, Windows, Android and iPhone
- Lead table and drag-and-drop pipeline
- Transparent 0–100 lead scoring
- Automatic stale-lead detection
- Duplicate detection across company, phone, email, website and social handles
- Activity timeline and follow-up tasks
- Quick Replies library with copy buttons and placeholders
- Free rule-based Smart Parse for rough notes
- Signed-client workspaces showing:
  - monthly fee and package
  - agreed services and scope
  - work completed, work left and due dates
  - delivery status and approval stages
  - payment due, paid history and renewal date
  - complete timeline and Drive/contract links
- Supabase email/password login and shared PostgreSQL database
- Google Sheets import and backup through a secure Netlify Function + Apps Script bridge

## Architecture

- Frontend: plain HTML, CSS and JavaScript in `site/`
- Hosting and secure proxy: Netlify
- Database and authentication: Supabase
- Existing spreadsheet bridge: Google Apps Script
- No npm install and no build step are required

## 1. Create Supabase

1. Create a free Supabase project.
2. Open **SQL Editor**.
3. Copy all content from `supabase/schema.sql` and run it once.
4. Open **Project Settings → API** (or the Connect panel).
5. Copy:
   - Project URL
   - Publishable key / anon key
6. In **Authentication → Users**, create or invite the Vireon team accounts.
7. To make the first user an admin, run:

```sql
update public.profiles
set role = 'admin', full_name = 'Your Name'
where email = 'your@email.com';
```

The app does not show public signup. Only users created in Supabase can sign in.

## 2. Deploy to Netlify

### Recommended: GitHub + Netlify

1. Create a new GitHub repository.
2. Upload the contents of this project folder to that repository.
3. In Netlify, choose **Add new project → Import an existing project** and select the repository.
4. Netlify will read the included `netlify.toml`, publish `site/`, and deploy the functions in `netlify/functions/`.

No build command is required. A normal drag-and-drop deploy of only the `site/` folder is suitable for previewing the interface, but it will not include the secure Google Sheets function.

### Netlify environment variables

In **Site configuration → Environment variables**, add:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `GOOGLE_SHEETS_WEB_APP_URL` (after completing Google Sheets setup)
- `GOOGLE_SHEETS_SHARED_SECRET` (a long random string)

Redeploy after changing environment variables.

## 3. Link the current Google Sheet

1. Open your existing leads spreadsheet.
2. Select **Extensions → Apps Script**.
3. Delete the starter code and paste `google-apps-script/Code.gs`.
4. Open **Project Settings → Script Properties**.
5. Add:
   - Property: `VIREON_SHARED_SECRET`
   - Value: exactly the same random secret used for `GOOGLE_SHEETS_SHARED_SECRET` in Netlify
6. Optional: add `VIREON_SHEET_NAME` if your tab is not the first tab. Example value: `Leads`.
7. Select **Deploy → New deployment → Web app**.
8. Set:
   - Execute as: **Me**
   - Who has access: **Anyone**
9. Deploy and copy the `/exec` Web App URL.
10. Put that URL in Netlify as `GOOGLE_SHEETS_WEB_APP_URL`.
11. Redeploy Netlify.
12. Sign in to Vireon CRM and open **Settings**.
13. Click **Test connection**, then **Import new rows**.

The import understands the existing headings:

- Lead Name
- Contact Number
- Email
- Business Type
- Lead Source
- Date First Contacted
- Current Situation / Remarks
- Lead Status
- Priority
- Next Follow-up Date

Possible duplicates are skipped during import. After the first import, edit data inside Vireon CRM and use **Update Sheet backup** to copy the latest CRM records back to the spreadsheet.

## 4. Recommended first use

1. Import the existing Sheet.
2. Review duplicate warnings and pipeline stages.
3. Add missing next follow-up dates.
4. Convert every signed/won lead into a Client Workspace.
5. Add the exact monthly deliverables and payment schedule for each active client.
6. Share the Netlify URL with teammates and create their Supabase accounts.

## Security notes

- The Supabase publishable key is intentionally safe to expose to the browser when Row Level Security is enabled.
- The Google Apps Script shared secret is stored only in Netlify and Apps Script settings, not in browser code.
- The Google Sheet is a secondary backup. Supabase is the primary source of truth.
- Keep the Supabase service-role key private; this app never needs it.
