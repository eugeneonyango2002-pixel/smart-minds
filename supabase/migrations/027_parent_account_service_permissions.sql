-- Allow the trusted server-side Edge Function service role to manage
-- parent accounts and learner links. This does not grant these rights to
-- ordinary authenticated users.
grant all privileges on table public.parent_accounts to service_role;
grant all privileges on table public.parent_students to service_role;
