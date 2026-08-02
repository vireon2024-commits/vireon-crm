# Features and Access

## Administrator

- All leads, clients and assignments
- Full dashboard, reports and CSV exports
- Client package values, monthly fees and payment records
- Google Sheets preview/import/push
- Team account creation, reset and activation/deactivation
- Lead/client creation and deletion controls
- Monthly cycles, deliverables, shoots and Quick Reply management
- Audit records retained in Supabase

## Team Member

- Assigned leads and linked requirements
- Tasks assigned to them
- Client workspaces needed for assigned lead/client/deliverable/shoot work
- Activity entry and follow-up actions
- Deliverable progress/status when assigned or managing the client
- Shoot status when assigned or managing the client
- Shared Quick Replies

## Team Members cannot access

- Client financial table
- Payment records
- Revenue and company reports
- Audit logs
- Google Sheets integration
- Team administration
- Destructive controls

The restrictions are enforced in Supabase Row Level Security, not only hidden in the interface.
