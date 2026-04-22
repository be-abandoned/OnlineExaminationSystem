create extension if not exists "pgcrypto";

-- =========================================================
-- Compatibility migration for legacy camelCase columns
-- =========================================================
do $$
begin
  if to_regclass('public.users') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='users' and column_name='schoolNo'
    ) then
      execute 'alter table public.users rename column "schoolNo" to school_no';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='users' and column_name='displayName'
    ) then
      execute 'alter table public.users rename column "displayName" to display_name';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='users' and column_name='createdAt'
    ) then
      execute 'alter table public.users rename column "createdAt" to created_at';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='users' and column_name='avatarUrl'
    ) then
      execute 'alter table public.users rename column "avatarUrl" to avatar_url';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='users' and column_name='gradeLevel'
    ) then
      execute 'alter table public.users rename column "gradeLevel" to grade_level';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='users' and column_name='subjectId'
    ) then
      execute 'alter table public.users rename column "subjectId" to subject_id';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='users' and column_name='classId'
    ) then
      execute 'alter table public.users rename column "classId" to class_id';
    end if;
  end if;
end $$;

-- =========================================================
-- Core tables (UUID-based)
-- =========================================================
create table if not exists public.users (
  id uuid primary key,
  role text not null check (role in ('student', 'teacher', 'admin')),
  phone text not null default '',
  school_no text not null,
  display_name text not null,
  age int,
  gender text check (gender in ('male', 'female', 'other')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  avatar_url text,
  grade_level int,
  subject_id text,
  class_id uuid,
  created_at timestamptz not null default now(),
  unique (role, school_no)
);

alter table public.users add column if not exists phone text not null default '';
alter table public.users add column if not exists school_no text;
alter table public.users add column if not exists display_name text;
alter table public.users add column if not exists status text default 'active';
alter table public.users add column if not exists avatar_url text;
alter table public.users add column if not exists grade_level int;
alter table public.users add column if not exists subject_id text;
alter table public.users add column if not exists class_id uuid;
alter table public.users add column if not exists created_at timestamptz default now();
alter table public.users add column if not exists age int;
alter table public.users add column if not exists gender text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='users' and column_name='password'
  ) then
    execute 'alter table public.users alter column password drop not null';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='users' and column_name='id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.users alter column id type uuid using id::uuid';
  end if;
exception
  when others then
    raise exception 'public.users.id 转换为 uuid 失败，请先清理非法 id 数据';
end $$;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade_level int not null,
  teacher_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='classes' and column_name='id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.classes alter column id type uuid using id::uuid';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='classes' and column_name='teacher_id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.classes alter column teacher_id type uuid using teacher_id::uuid';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_class_fk'
  ) then
    alter table public.users
      add constraint users_class_fk
      foreign key (class_id) references public.classes(id) on delete set null;
  end if;
end $$;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  content text not null,
  target jsonb not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='messages' and column_name='id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.messages alter column id type uuid using id::uuid';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='messages' and column_name='teacher_id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.messages alter column teacher_id type uuid using teacher_id::uuid';
  end if;
end $$;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('single', 'multiple', 'true_false', 'blank', 'short')),
  stem jsonb not null,
  options jsonb,
  answer_key jsonb,
  default_score int not null,
  grade_level int,
  subject_id text,
  analysis text,
  difficulty int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='questions' and column_name='id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.questions alter column id type uuid using id::uuid';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='questions' and column_name='teacher_id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.questions alter column teacher_id type uuid using teacher_id::uuid';
  end if;
end $$;

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null check (status in ('draft', 'published', 'closed')),
  duration_minutes int not null,
  grade_level int,
  subject_id text,
  start_at timestamptz,
  end_at timestamptz,
  attempt_limit int not null,
  shuffle_questions boolean not null default false,
  assigned_class_ids jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exams' and column_name='id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.exams alter column id type uuid using id::uuid';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exams' and column_name='teacher_id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.exams alter column teacher_id type uuid using teacher_id::uuid';
  end if;
end $$;

create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  sort_order int not null,
  score int not null
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exam_questions' and column_name='id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.exam_questions alter column id type uuid using id::uuid';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exam_questions' and column_name='exam_id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.exam_questions alter column exam_id type uuid using exam_id::uuid';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exam_questions' and column_name='question_id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.exam_questions alter column question_id type uuid using question_id::uuid';
  end if;
end $$;

create table if not exists public.exam_assignments (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exam_assignments' and column_name='id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.exam_assignments alter column id type uuid using id::uuid';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exam_assignments' and column_name='exam_id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.exam_assignments alter column exam_id type uuid using exam_id::uuid';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exam_assignments' and column_name='student_id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.exam_assignments alter column student_id type uuid using student_id::uuid';
  end if;
end $$;

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  status text not null check (status in ('in_progress', 'submitted', 'graded')),
  started_at timestamptz not null,
  submitted_at timestamptz,
  total_score numeric not null default 0,
  score_published boolean not null default false
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='attempts' and column_name='id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.attempts alter column id type uuid using id::uuid';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='attempts' and column_name='exam_id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.attempts alter column exam_id type uuid using exam_id::uuid';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='attempts' and column_name='student_id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.attempts alter column student_id type uuid using student_id::uuid';
  end if;
end $$;

create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  answer jsonb,
  auto_score numeric not null default 0,
  manual_score numeric not null default 0,
  teacher_comment text,
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='attempt_answers' and column_name='id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.attempt_answers alter column id type uuid using id::uuid';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='attempt_answers' and column_name='attempt_id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.attempt_answers alter column attempt_id type uuid using attempt_id::uuid';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='attempt_answers' and column_name='question_id' and data_type <> 'uuid'
  ) then
    execute 'alter table public.attempt_answers alter column question_id type uuid using question_id::uuid';
  end if;
end $$;

-- =========================================================
-- Indexes
-- =========================================================
create index if not exists idx_users_role on public.users(role);
create index if not exists idx_users_school_no on public.users(school_no);
create index if not exists idx_questions_teacher on public.questions(teacher_id);
create index if not exists idx_exams_teacher on public.exams(teacher_id);
create index if not exists idx_exam_assignments_student on public.exam_assignments(student_id);
create index if not exists idx_attempts_student on public.attempts(student_id);

-- =========================================================
-- RLS default state (disabled by default; enable via rls.sql)
-- =========================================================
alter table public.users disable row level security;
alter table public.classes disable row level security;
alter table public.messages disable row level security;
alter table public.questions disable row level security;
alter table public.exams disable row level security;
alter table public.exam_questions disable row level security;
alter table public.exam_assignments disable row level security;
alter table public.attempts disable row level security;
alter table public.attempt_answers disable row level security;

-- =========================================================
-- Auth trigger: auth.users -> public.users
-- =========================================================
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'student');
  v_school_no text := coalesce(new.raw_user_meta_data->>'schoolNo', split_part(new.email, '@', 1));
  v_display_name text := coalesce(new.raw_user_meta_data->>'displayName', v_school_no);
begin
  insert into public.users (
    id, role, phone, school_no, display_name, status, created_at
  ) values (
    new.id,
    v_role,
    '',
    v_school_no,
    v_display_name,
    'active',
    now()
  )
  on conflict (id) do update
  set role = excluded.role,
      school_no = excluded.school_no,
      display_name = excluded.display_name;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_created();
