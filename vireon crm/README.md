# Vireon Lead Hub — Final Release

A deployment-ready internal CRM for Vireon, built around the actual workflow from first contact to signed-client delivery.

## What is included

- Live Google Sheets import and safe CRM-to-Sheet synchronization
- No demo leads or demo clients
- Separate Administrator and Team Member workspaces
- Supabase authentication, PostgreSQL database and Row Level Security
- Lead table, scoring, duplicate warning, stale-lead detection and drag-and-drop pipeline
- Follow-ups, tasks, activities and reusable Quick Replies
- Signed-client workspaces with monthly cycles, deliverables, shoots, approvals and payments
- Admin-only finance, reports, team access and synchronization controls
- Responsive Vireon-branded interface for Mac, Windows, iPhone and Android
- PWA installation, offline read-only behavior, motion and reduced-motion support
- CSV exports protected against spreadsheet formula injection
- Netlify server functions for Sheets and team account administration

## Important data note

The application contains **no sample lead/client records**. During setup, the Administrator connects the existing Google Sheet and uses **Preview & import real data**. Exact CRM ID, phone or email matches update existing records; otherwise a new record is created. Company-name-only matches without contact details require review.

The file under `data/` is a reference snapshot reconstructed from the spreadsheet image shared during development. It is not loaded by the application and is not a replacement for the live import.

## Start here

Read [START-HERE.md](START-HERE.md), then follow [docs/SETUP-GUIDE.md](docs/SETUP-GUIDE.md) in order.

## What “real spreadsheet data” means

No live Google credentials or direct Sheet connection are stored in this download. During setup, the Administrator connects the current Vireon Sheet and previews the rows before importing them. The CRM then stores those real rows in Supabase. This prevents an old screenshot or reconstructed CSV from silently becoming the business database.

The included automated checks validate the app logic, role-specific rendering, Sheets mapping, formatting preservation and server functions. Final live acceptance still requires the one-time Supabase, Netlify and Google Apps Script setup described in the guide.

## Architecture

- Frontend: dependency-free HTML, CSS and JavaScript in `site/`
- Hosting and server functions: Netlify
- Authentication and database: Supabase
- Spreadsheet bridge: bound Google Apps Script
- Build command: none
- Publish directory: `site`
- Functions directory: `netlify/functions`

## Security model

- The browser receives only the Supabase project URL and publishable key.
- The Supabase secret key and Google Sheets shared secret stay inside Netlify Functions.
- The personal account is the only Administrator after running `MAKE_ADMIN.sql`.
- Accounts created inside the app are always Team Members.
- Team Members receive only records assigned to them or required to perform assigned work.
- Client finances, payments, reports, audit history, team administration and Sheets controls are Administrator-only.

## Main files

- `supabase/FINAL_SETUP.sql` — safe database setup/upgrade
- `supabase/MAKE_ADMIN.sql` — makes one personal account Admin and everyone else Team Member
- `supabase/VERIFY_SETUP.sql` — read-only verification
- `supabase/OPTIONAL_CLEAN_START.sql` — optional destructive removal of old test records
- `google-apps-script/Code.gs` — live Google Sheets bridge
- `docs/TEST-REPORT.md` — checks completed before packaging
- `docs/FINAL-ACCEPTANCE-CHECKLIST.md` — one-time live deployment verification
