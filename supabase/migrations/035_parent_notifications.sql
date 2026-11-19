-- Parent notifications for published examinations and recorded fee payments.
create table if not exists public.parent_notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  parent_account_id uuid not null references public.parent_accounts(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null check (notification_type in ('exam_published','fee_payment')),
  related_record_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists parent_notifications_account_created_idx
  on public.parent_notifications(parent_account_id, created_at desc);
alter table public.parent_notifications enable row level security;
drop policy if exists "Parents read own notifications" on public.parent_notifications;
create policy "Parents read own notifications" on public.parent_notifications
for select to authenticated using (
  exists(select 1 from public.parent_accounts pa
    where pa.id=parent_notifications.parent_account_id
      and pa.auth_user_id=auth.uid() and pa.status='active')
);
drop policy if exists "Parents mark own notifications read" on public.parent_notifications;
create policy "Parents mark own notifications read" on public.parent_notifications
for update to authenticated using (
  exists(select 1 from public.parent_accounts pa
    where pa.id=parent_notifications.parent_account_id
      and pa.auth_user_id=auth.uid() and pa.status='active')
) with check (
  exists(select 1 from public.parent_accounts pa
    where pa.id=parent_notifications.parent_account_id
      and pa.auth_user_id=auth.uid() and pa.status='active')
);
grant select, update on public.parent_notifications to authenticated;

create or replace function public.notify_parents_exam_published()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status='published' and old.status is distinct from 'published' then
    insert into public.parent_notifications(school_id,parent_account_id,student_id,title,message,notification_type,related_record_id)
    select new.school_id, ps.parent_account_id, s.id,
      'Examination results published',
      'Results for '||new.name||' are now available in the parent portal for '||s.first_name||' '||s.last_name||'.',
      'exam_published',new.id
    from public.students s
    join public.parent_students ps on ps.student_id=s.id and ps.school_id=s.school_id
    join public.parent_accounts pa on pa.id=ps.parent_account_id and pa.school_id=ps.school_id and pa.status='active'
    where s.school_id=new.school_id and s.class_id=new.class_id;
  end if;
  return new;
end; $$;
drop trigger if exists trg_notify_parents_exam_published on public.examinations;
create trigger trg_notify_parents_exam_published after update of status on public.examinations
for each row execute function public.notify_parents_exam_published();

create or replace function public.notify_parents_fee_payment()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare learner_name text;
begin
  select first_name||' '||last_name into learner_name from public.students where id=new.student_id and school_id=new.school_id;
  insert into public.parent_notifications(school_id,parent_account_id,student_id,title,message,notification_type,related_record_id)
  select new.school_id,ps.parent_account_id,new.student_id,
    'Fee payment recorded',
    'A payment of KES '||to_char(new.amount_kes,'FM999G999G990D00')||' was recorded for '||coalesce(learner_name,'your learner')||'. Receipt: '||coalesce(new.receipt_number,'pending')||'.',
    'fee_payment',new.id
  from public.parent_students ps
  join public.parent_accounts pa on pa.id=ps.parent_account_id and pa.school_id=ps.school_id and pa.status='active'
  where ps.student_id=new.student_id and ps.school_id=new.school_id;
  return new;
end; $$;
drop trigger if exists trg_notify_parents_fee_payment on public.fee_payments;
create trigger trg_notify_parents_fee_payment after insert on public.fee_payments
for each row execute function public.notify_parents_fee_payment();
