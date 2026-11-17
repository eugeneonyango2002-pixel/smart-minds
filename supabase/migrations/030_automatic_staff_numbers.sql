-- Automatically assign sequential staff numbers per school and calendar year.
create or replace function public.generate_staff_employee_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_year text := to_char(current_date, 'YYYY');
  next_number integer;
begin
  if new.employee_number is null or btrim(new.employee_number) = '' then
    perform pg_advisory_xact_lock(hashtext(new.school_id::text));
    select coalesce(max(substring(employee_number from '([0-9]+)$')::integer), 0) + 1
      into next_number
      from public.staff
      where school_id = new.school_id
        and employee_number like 'SM/STAFF/' || current_year || '/%';
    new.employee_number := 'SM/STAFF/' || current_year || '/' || lpad(next_number::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists staff_generate_employee_number on public.staff;
create trigger staff_generate_employee_number
before insert on public.staff
for each row execute function public.generate_staff_employee_number();
