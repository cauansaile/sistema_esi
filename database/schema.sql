-- Execute no SQL Editor do Supabase em um projeto NOVO.
create extension if not exists pgcrypto;
create table public.schools (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table public.memberships (school_id uuid not null references public.schools(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role text not null default 'staff' check(role in ('admin','staff')), primary key(school_id,user_id));
create or replace function public.is_school_member(s uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.memberships m where m.school_id=s and m.user_id=(select auth.uid())) $$;
revoke all on function public.is_school_member(uuid) from public;
grant execute on function public.is_school_member(uuid) to authenticated;
create table public.students (id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id), name text not null check(length(trim(name))>0), birth date, classroom text not null, guardian_name text not null, guardian_relation text, guardian_phone text not null, guardian_email text, created_at timestamptz not null default now());
create table public.payments (id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id), student_id uuid not null references public.students(id) on delete cascade, description text not null, due_date date not null, amount numeric(12,2) not null check(amount>0), status text not null default 'pending' check(status in ('paid','pending')), created_at timestamptz not null default now());
create table public.expenses (id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id), description text not null, category text not null default 'Geral', due_date date not null, amount numeric(12,2) not null check(amount>0), created_at timestamptz not null default now());
create table public.grades (id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id), student_id uuid not null references public.students(id) on delete cascade, subject text not null, score numeric(3,1) not null check(score between 0 and 10), created_at timestamptz not null default now());
-- Evita lançar nota/pagamento em aluno de outra escola.
create or replace function public.check_student_school() returns trigger language plpgsql set search_path = '' as $$ begin if not exists(select 1 from public.students s where s.id=new.student_id and s.school_id=new.school_id) then raise exception 'Aluno não pertence à escola'; end if; return new; end $$;
create trigger payments_school_check before insert or update on public.payments for each row execute function public.check_student_school();
create trigger grades_school_check before insert or update on public.grades for each row execute function public.check_student_school();
create index on public.students(school_id);create index on public.payments(school_id);create index on public.expenses(school_id);create index on public.grades(school_id);
alter table public.schools enable row level security;
alter table public.memberships enable row level security;
alter table public.students enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.grades enable row level security;
create policy schools_read on public.schools for select to authenticated using(public.is_school_member(id));
create policy memberships_read on public.memberships for select to authenticated using(user_id=(select auth.uid()));
create policy students_access on public.students for all to authenticated using(public.is_school_member(school_id)) with check(public.is_school_member(school_id));
create policy payments_access on public.payments for all to authenticated using(public.is_school_member(school_id)) with check(public.is_school_member(school_id));
create policy expenses_access on public.expenses for all to authenticated using(public.is_school_member(school_id)) with check(public.is_school_member(school_id));
create policy grades_access on public.grades for all to authenticated using(public.is_school_member(school_id)) with check(public.is_school_member(school_id));
-- Escola inicial: execute UMA VEZ, copie o id retornado.
insert into public.schools(name) values ('Escola Sonho Infantil') returning id;
-- Depois crie usuários em Authentication > Users e vincule cada usuário:
-- insert into public.memberships(school_id,user_id,role) values ('UUID_DA_ESCOLA','UUID_DO_USUARIO','admin');
