-- Smart Minds: configurable school administration structure and staff appointments.
create table if not exists public.school_positions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  department text,
  description text,
  parent_position_id uuid references public.school_positions(id) on delete set null,
  staff_id uuid references public.staff(id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_position_title_unique unique (school_id, title),
  constraint school_position_school_id_unique unique (school_id, id)
);

create index if not exists school_positions_school_order_idx
  on public.school_positions(school_id, sort_order, title);

create or replace function public.validate_school_position()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_position_id is not null and not exists (
    select 1 from public.school_positions p
    where p.id = new.parent_position_id and p.school_id = new.school_id
  ) then
    raise exception 'The reporting position must belong to the same school.';
  end if;
  if new.staff_id is not null and not exists (
    select 1 from public.staff s
    where s.id = new.staff_id and s.school_id = new.school_id
  ) then
    raise exception 'The appointed staff member must belong to the same school.';
  end if;
  if new.parent_position_id = new.id then
    raise exception 'A position cannot report to itself.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists school_position_validate on public.school_positions;
create trigger school_position_validate
before insert or update on public.school_positions
for each row execute function public.validate_school_position();

alter table public.school_positions enable row level security;
drop policy if exists "School positions readable by members" on public.school_positions;
create policy "School positions readable by members" on public.school_positions
for select to authenticated
using (public.is_platform_admin() or public.is_school_member(school_id));

drop policy if exists "School positions managed by school leaders" on public.school_positions;
create policy "School positions managed by school leaders" on public.school_positions
for all to authenticated
using (public.is_platform_admin() or public.has_school_role(school_id, array['head_teacher','school_admin']::text[]))
with check (public.is_platform_admin() or public.has_school_role(school_id, array['head_teacher','school_admin']::text[]));

grant select, insert, update, delete on public.school_positions to authenticated;
