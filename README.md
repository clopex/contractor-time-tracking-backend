# Contractor Time Tracking SaaS Backend

Supabase backend repository for the Contractor Time Tracking SaaS product.

## Stack

- Supabase Postgres
- Supabase Auth
- Supabase Storage
- Supabase Edge Functions
- Row Level Security by organization and membership role

## Structure

- `supabase/config.toml` local Supabase configuration
- `supabase/migrations/` schema migrations
- `supabase/seed.sql` local seed data
- `supabase/functions/` edge functions

## Local development

1. Copy `.env.example` to `.env`.
2. Install the Supabase CLI.
3. Link to your hosted project:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_PROJECT_REF -p "YOUR_DB_PASSWORD"
```
4. Start local services:

```bash
supabase start
```

5. Reset database and apply seed data:

```bash
supabase db reset
```

## Edge Functions

- `timer-start`
- `timer-stop`
- `time-entry-create`
- `time-entry-update`
- `timesheet-submit`
- `timesheet-approve`
- `timesheet-reject`
- `reports-summary`
- `invite-member`
- `billing-checkout`
- `billing-portal`
- `stripe-webhook`
- `ai-assistant`

## Notes

- Billing and AI are scaffolded, but intentionally minimal until core time tracking is stable.
- The canonical data model lives in the SQL migrations in this repository.
- Client apps should use the Supabase `publishable key`.
- Server-side integrations should use the Supabase `secret key`.
- Edge Functions remain compatible with Supabase hosted defaults by falling back to legacy function env vars when needed.
- AI provider for the current setup is `Gemini`, exposed to functions through `GEMINI_API_KEY`.
