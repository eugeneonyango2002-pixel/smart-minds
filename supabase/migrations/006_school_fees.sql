-- Smart Minds Phase 4: School fees and payment records
create table if not exists public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  term_id uuid references public.terms(id) on delete restrict,
  item_name text not null,
  amount_kes numeric(12,2) not null check (amount_kes > 0),
  due_date date,
  created_at timestamptz not null default now(),
  constraint fee_structure_school_id_unique unique (school_id,id),
  constraint fee_structure_class_same_school_fk foreign key (school_id,class_id)
    references public.classes(school_id,id) on delete cascade
);
create index if not exists fee_structures_school_class_idx on public.fee_structures(school_id,class_id);

create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  fee_structure_id uuid not null,
  amount_kes numeric(12,2) not null check (amount_kes > 0),
  payment_method text not null check (payment_method in ('cash','mpesa','bank','cheque','other')),
  transaction_reference text,
  payment_date date not null default current_date,
  notes text,
  received_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint fee_payment_student_same_school_fk foreign key (school_id,student_id)
    references public.students(school_id,id) on delete cascade,
  constraint fee_payment_structure_same_school_fk foreign key (school_id,fee_structure_id)
    references public.fee_structures(school_id,id) on delete restrict
);
create index if not exists fee_payments_school_student_idx on public.fee_payments(school_id,student_id);
create index if not exists fee_payments_school_date_idx on public.fee_payments(school_id,payment_date desc);

alter table public.fee_structures enable row level security;
alter table public.fee_payments enable row level security;
drop policy if exists "Fee structures school access" on public.fee_structures;
create policy "Fee structures school access" on public.fee_structures
for all to authenticated
using (public.is_platform_admin() or public.is_school_member(school_id))
with check (public.is_platform_admin() or public.is_school_member(school_id));
drop policy if exists "Fee payments school access" on public.fee_payments;
create policy "Fee payments school access" on public.fee_payments
for all to authenticated
using (public.is_platform_admin() or public.is_school_member(school_id))
with check (public.is_platform_admin() or public.is_school_member(school_id));
grant select,insert,update,delete on public.fee_structures to authenticated;
grant select,insert,update,delete on public.fee_payments to authenticated;
