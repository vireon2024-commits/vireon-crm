# Vireon Lead Hub — Complete Setup Guide

Follow the steps in this exact order. The setup keeps Supabase as the main database and connects the existing Google Sheet as the live import/synchronized mirror.

---

## Step 1 — Make two backups

### Back up the Google Sheet

1. Open the current Vireon leads spreadsheet.
2. Select **File → Make a copy**.
3. Name it `Vireon Leads Backup Before CRM`.

### Keep the current Netlify deployment available

1. Open Netlify.
2. Open the current Vireon site.
3. Open **Deploys**.
4. Do not delete the previous deploy. Netlify can restore it if required.

---

## Step 2 — Replace the old GitHub app with the final files

Unzip the final download. Inside it you should see:

```text
site/
netlify/
supabase/
google-apps-script/
docs/
data/
netlify.toml
README.md
START-HERE.md
```

Open the existing GitHub repository and navigate to the folder that currently contains `netlify.toml`.

For the previously used nested repository, this may be similar to:

```text
vireon crm/vireon-crm-netlify/
```

Replace the old versions of these items with the final versions:

```text
site/
netlify/
supabase/
google-apps-script/
netlify.toml
README.md
```

Also upload:

```text
docs/
data/
START-HERE.md
.env.example
```

Use this commit message:

```text
Install final Vireon Lead Hub
```

After committing, Netlify may start a deployment. It is normal for the app to show a setup screen until the database and environment variables are completed.

### Netlify build settings

The folder containing `netlify.toml` is the app root.

- **Build command:** leave empty
- **Publish directory:** `site`
- **Functions directory:** `netlify/functions`

If the repository is nested, keep the existing Netlify **Base directory** pointed to the folder containing `netlify.toml`.

---

## Step 3 — Run the final Supabase database setup

1. Open the existing Supabase project used by the current app.
2. Select **SQL Editor**.
3. Select **New query**.
4. Open `supabase/FINAL_SETUP.sql` from the downloaded package.
5. Copy the complete file into Supabase.
6. Select **Run**.

This script is designed to work over the earlier Vireon CRM schema and preserve existing records. It adds the final tables, policies, client cycles, shoots, audit history, private finances and Team Member restrictions.

### Optional clean start

The final package itself contains no demo leads or clients. Existing records already stored in Supabase remain in place.

Run `supabase/OPTIONAL_CLEAN_START.sql` only when all current CRM lead/client records are disposable tests. It deletes operational CRM data and cannot be undone from the app. It keeps login accounts, roles, Quick Replies and stale rules.

When unsure, skip this optional file. The live Sheet import can update exact phone/email matches and you can remove unwanted records later as Administrator.

---

## Step 4 — Create or confirm your personal login

1. In Supabase, select **Authentication → Users**.
2. Find the personal email you will use for the Administrator workspace.
3. When it does not exist, select **Add user → Create new user**.
4. Enter your personal email and a strong password.
5. Enable **Auto confirm user** when shown.
6. Create the user.

Do not create staff accounts yet.

---

## Step 5 — Make only your personal account Administrator

1. Open `supabase/MAKE_ADMIN.sql`.
2. Replace:

```text
YOUR_PERSONAL_EMAIL@example.com
```

with your exact personal login email.

3. Copy the complete edited file into a new Supabase SQL query.
4. Select **Run**.

The script first checks that the email exists. It then makes that one account `admin` and makes every other account `member`.

Run `supabase/VERIFY_SETUP.sql` afterward. Confirm:

- every `*_ready` result is `true`
- `active_admins` equals `1`
- policy rows are returned for all Vireon tables

---

## Step 6 — Copy the Supabase keys

In Supabase, open **Project Settings → API Keys** or the project **Connect** panel.

Copy:

1. **Project URL**
2. **Publishable key** — normally begins with `sb_publishable_`
3. **Secret key** — normally begins with `sb_secret_`

The secret key is server-only. Never put it in `site/app.js`, GitHub, Apps Script or any browser code.

A legacy `service_role` key can still be used as `SUPABASE_SERVICE_ROLE_KEY`, but the final package prefers the modern `SUPABASE_SECRET_KEY` variable.

---

## Step 7 — Add the first Netlify environment variables

1. Open the Vireon site in Netlify.
2. Open **Site configuration → Environment variables**.
3. Add:

```text
SUPABASE_URL
```

Value: the Supabase Project URL.

```text
SUPABASE_PUBLISHABLE_KEY
```

Value: the Supabase publishable key.

```text
SUPABASE_SECRET_KEY
```

Value: the Supabase secret key.

4. Apply them to the production deploy context and Functions.
5. Do not expose the secret in a public variable or commit it to GitHub.

You will add the two Google Sheets variables in Step 10.

---

## Step 8 — Generate the Google Sheets shared secret

On the Mac, open Terminal and run:

```bash
openssl rand -hex 32
```

Copy the 64-character result. Save it temporarily in a password manager. This same value will be entered in Netlify and Apps Script.

Do not reuse your Google or Supabase password.

---

## Step 9 — Install the Apps Script into the real leads Sheet

1. Open the current Vireon leads Google Sheet.
2. Confirm the correct tab name. Based on the current layout, use:

```text
leads new
```

3. From the Sheet, select **Extensions → Apps Script**.
4. Delete the existing starter code in `Code.gs`.
5. Open `google-apps-script/Code.gs` from the final package.
6. Paste the complete code and save.
7. In Apps Script, open **Project Settings**.
8. Under **Script Properties**, add these three properties:

```text
VIREON_SHARED_SECRET
```

Value: the 64-character secret generated in Step 8.

```text
VIREON_SHEET_NAME
```

Value:

```text
leads new
```

```text
VIREON_SPREADSHEET_ID
```

Value: the part of the Google Sheet URL between `/d/` and `/edit`.

Example URL shape:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
```

Adding the Spreadsheet ID makes the web app reliable even when Google does not provide an active spreadsheet context.

---

## Step 10 — Deploy the Apps Script Web App

1. In Apps Script, select **Deploy → New deployment**.
2. Select the gear icon and choose **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Select **Deploy**.
5. Approve the Google permission request.
6. Copy the Web App URL ending in `/exec`.

When you later edit `Code.gs`, use **Deploy → Manage deployments → Edit → New version → Deploy**. Saving code alone does not update an existing Web App deployment.

---

## Step 11 — Add the Google Sheets variables to Netlify

In **Netlify → Site configuration → Environment variables**, add:

```text
GOOGLE_SHEETS_WEB_APP_URL
```

Value: the Apps Script `/exec` URL.

```text
GOOGLE_SHEETS_SHARED_SECRET
```

Value: exactly the same 64-character value used for `VIREON_SHARED_SECRET`.

Your final Netlify variable list should be:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
GOOGLE_SHEETS_WEB_APP_URL
GOOGLE_SHEETS_SHARED_SECRET
```

Do not add `SUPABASE_SERVICE_ROLE_KEY` when `SUPABASE_SECRET_KEY` is already set.

---

## Step 12 — Redeploy the final app

1. In Netlify, open **Deploys**.
2. Choose **Trigger deploy → Deploy site**, or retry the latest deploy.
3. Wait until the deploy is marked **Published**.
4. Open the live site.
5. On Mac, perform a hard refresh:

```text
Command + Shift + R
```

6. Sign in with the personal Administrator email.

You should see Administrator navigation including **Reports**, **Team** and **Settings**.

---

## Step 13 — Import the current real spreadsheet data

Before this step, do not add sample leads manually.

1. In the app, open **Settings**.
2. Select **Test connection**.
3. Confirm the message shows the correct spreadsheet, tab and detected header row.
4. Select **Preview & import real data**.
5. Review the summary:
   - **New leads** — new CRM records
   - **Updates** — exact CRM ID, phone or email match
   - **Needs review** — company-name-only match without phone/email
   - **Skipped** — blank/invalid rows
6. For every **Needs review** row, choose:
   - Import as new
   - Update match
   - Skip
7. Select **Import approved rows**.
8. Wait for the import summary.

The import writes a stable `CRM ID` back to each linked Sheet row. Future imports use this ID first, reducing duplicate risk.

The importer intentionally allows the same company name to exist with a different phone number. It does not merge separate contacts merely because the names match.

---

## Step 14 — Check the imported data before syncing back

Open:

- **Dashboard** — confirm the total leads and stage counts
- **Leads** — compare several names, phones, statuses and follow-up notes
- **Pipeline** — verify the mapped stages
- **Follow-ups** — verify date-based and text follow-ups

Only after the data looks correct:

1. Return to **Settings**.
2. Select **Sync CRM to Sheet**.
3. Read and accept the confirmation.

This updates matching values and appends new CRM leads. It does not clear the Sheet. Existing design, headers, dropdowns and formatting are preserved; new appended rows copy the previous row's formatting and validation rules.

---

## Step 15 — Create staff and cofounder accounts

1. Open **Team** as Administrator.
2. Select **Add teammate**.
3. Enter the person's name, job title, email and a temporary password.
4. Create the account.

Every account created here is a **Team Member**, not an Administrator.

Share the login privately. The teammate can change the password after signing in.

### Assign work

- Edit a lead and select **Assigned teammate**.
- Edit a client and select **Account manager**.
- Assign individual deliverables and shoots to the responsible teammate.
- Create tasks and choose the assigned person.

---

## Step 16 — Test the Team Member workspace

1. Open an Incognito/Private browser window.
2. Sign in with one staff account.
3. Confirm the navigation contains only:
   - My Dashboard
   - My Leads
   - My Pipeline
   - My Follow-ups
   - My Clients
   - Activities
   - Quick Replies
4. Confirm the account cannot see:
   - Reports
   - Team
   - Settings
   - Revenue or monthly fees
   - Payments
   - Google Sheets controls
   - Delete controls
5. Assign one lead or task from the Administrator account and refresh the Team Member window.
6. Confirm only the assigned work appears.

---

## Step 17 — Start using signed-client workspaces

When a lead becomes a client:

1. Open the lead.
2. Select **Sign as client**.
3. Enter the package, monthly fee, contract dates, services, account manager and links.
4. Create a monthly delivery cycle.
5. Add the exact promised deliverables and quantities.
6. Add shoots and assign people.
7. Record payments in the Administrator-only finance section.
8. Let assigned Team Members update completed quantity, work status and shoot status.

Each monthly cycle remains stored separately so prior months are not overwritten.

After the first Administrator and Team Member tests, complete `docs/FINAL-ACCEPTANCE-CHECKLIST.md` once.

---

## Step 18 — Ongoing operating routine

Recommended weekly routine:

1. Import the Sheet when leads are still being added there.
2. Record all new follow-ups and activities in the CRM.
3. Move stages from the pipeline.
4. Review stale leads and overdue tasks.
5. Update client deliverables and shoots.
6. Record received/due payments as Administrator.
7. Use **Sync CRM to Sheet** after reviewing CRM changes.
8. Export Leads CSV and Clients CSV periodically as an extra backup.

Supabase is the source of truth after the first import. Google Sheets is the synchronized mirror and familiar backup.

---

## Rollback

### App rollback

In Netlify:

1. Open **Deploys**.
2. Select the last working deployment.
3. Choose **Publish deploy**.

### Database rollback

`FINAL_SETUP.sql` is additive and preserves operational rows. Do not use `OPTIONAL_CLEAN_START.sql` as a rollback tool. When a database problem occurs, stop editing data and use the Sheet copy/CSV exports to verify records before making further SQL changes.
