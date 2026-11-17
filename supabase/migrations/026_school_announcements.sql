-- Smart Minds Phase 26: School announcements for staff and parent portal.
create table if not exists public.school_announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 180),
  message text not null check (char_length(trim(message)) between 3 and 10000),
  status text not null default 'published' check (status in ('draft','published')),
  publish_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists school_announcements_school_publish_idx
  on public.school_announcements(school_id, status, publish_at desc);
alter table public.school_announcements enable row level security;
drop policy if exists "School staff manage announcements" on public.school_announcements;
create policy "School staff manage announcements" on public.school_announcements
for all to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','secretary']::text[]))
with check (public.has_school_role(school_id, array['school_admin','head_teacher','secretary']::text[]));
drop policy if exists "Parents read published school announcements" on public.school_announcements;
create policy "Parents read published school announcements" on public.school_announcements
for select to authenticated
using (status = 'published' and publish_at <= now() and public.is_active_parent_in_school(school_id));
grant select, insert, update, delete on public.school_announcements to authenticated;
