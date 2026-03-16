insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'owner@example.com',
    crypt('Password123!', gen_salt('bf')),
    timezone('utc', now()),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Owner Demo"}',
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'manager@example.com',
    crypt('Password123!', gen_salt('bf')),
    timezone('utc', now()),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Manager Demo"}',
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated',
    'authenticated',
    'contractor@example.com',
    crypt('Password123!', gen_salt('bf')),
    timezone('utc', now()),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Contractor Demo"}',
    timezone('utc', now()),
    timezone('utc', now())
  )
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at
)
values
  (
    gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    '{"sub":"11111111-1111-1111-1111-111111111111","email":"owner@example.com"}',
    'email',
    '11111111-1111-1111-1111-111111111111',
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    gen_random_uuid(),
    '22222222-2222-2222-2222-222222222222',
    '{"sub":"22222222-2222-2222-2222-222222222222","email":"manager@example.com"}',
    'email',
    '22222222-2222-2222-2222-222222222222',
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    gen_random_uuid(),
    '33333333-3333-3333-3333-333333333333',
    '{"sub":"33333333-3333-3333-3333-333333333333","email":"contractor@example.com"}',
    'email',
    '33333333-3333-3333-3333-333333333333',
    timezone('utc', now()),
    timezone('utc', now())
  )
on conflict do nothing;

insert into public.user_profiles (id, full_name, email)
values
  ('11111111-1111-1111-1111-111111111111', 'Owner Demo', 'owner@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'Manager Demo', 'manager@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'Contractor Demo', 'contractor@example.com')
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, timezone, created_by)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Demo Contractors',
  'demo-contractors',
  'Europe/Sarajevo',
  '11111111-1111-1111-1111-111111111111'
)
on conflict (id) do nothing;

insert into public.memberships (id, organization_id, user_id, role, hourly_rate_cents, invited_by)
values
  (
    'aaaa1111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'owner',
    6500,
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'aaaa2222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'manager',
    5500,
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'aaaa3333-3333-3333-3333-333333333333',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-3333-3333-3333-333333333333',
    'contractor',
    4000,
    '11111111-1111-1111-1111-111111111111'
  )
on conflict (organization_id, user_id) do nothing;

insert into public.clients (id, organization_id, name, contact_email, notes)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Alpha Construction',
  'client@alphaconstruction.test',
  'Primary demo client'
)
on conflict (id) do nothing;

insert into public.projects (id, organization_id, client_id, name, code, description, budget_cents, hourly_rate_cents)
values (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Kitchen Remodel - Block A',
  'KITCHEN-A',
  'Demo project for contractor time tracking',
  2500000,
  6500
)
on conflict (id) do nothing;

insert into public.tasks (id, organization_id, project_id, name, description, is_billable)
values
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Site Preparation',
    'Initial prep work',
    true
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Material Pickup',
    'Non-installation logistics',
    false
  )
on conflict (id) do nothing;

insert into public.rate_cards (organization_id, membership_id, project_id, hourly_rate_cents, effective_from)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'aaaa3333-3333-3333-3333-333333333333',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  4000,
  current_date
)
on conflict do nothing;

insert into public.subscriptions (
  organization_id,
  provider,
  provider_customer_id,
  provider_subscription_id,
  plan_code,
  status,
  seats,
  trial_ends_at
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'stripe',
  'cus_demo_contractors',
  'sub_demo_contractors',
  'starter',
  'trialing',
  3,
  timezone('utc', now()) + interval '14 days'
)
on conflict (organization_id) do nothing;

insert into public.entitlements (organization_id, code, enabled, limit_value)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'advanced_reports', true, null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ai_assistant', true, 200),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'team_members', true, 3)
on conflict (organization_id, code) do nothing;
