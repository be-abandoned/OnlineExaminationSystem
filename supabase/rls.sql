-- Supabase RLS policies (phase 3)
-- Prerequisite:
-- 1) auth.users.id should map to public.users.id
-- 2) JWT user id should be available as auth.uid()

-- ------------------------------------------------------------
-- Helper functions
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  );
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'teacher'
  );
$$;

create or replace function public.is_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'student'
  );
$$;

-- ------------------------------------------------------------
-- Enable RLS
-- ------------------------------------------------------------
alter table public.users enable row level security;
alter table public.classes enable row level security;
alter table public.messages enable row level security;
alter table public.questions enable row level security;
alter table public.exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_assignments enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
drop policy if exists users_admin_all on public.users;
drop policy if exists users_self_read on public.users;
drop policy if exists users_self_update on public.users;

create policy users_admin_all on public.users
for all
using (public.is_admin())
with check (public.is_admin());

create policy users_self_read on public.users
for select
using (id = auth.uid());

create policy users_self_update on public.users
for update
using (id = auth.uid())
with check (id = auth.uid());

-- ------------------------------------------------------------
-- classes
-- ------------------------------------------------------------
drop policy if exists classes_admin_all on public.classes;
drop policy if exists classes_teacher_read on public.classes;
drop policy if exists classes_student_read on public.classes;

create policy classes_admin_all on public.classes
for all
using (public.is_admin())
with check (public.is_admin());

create policy classes_teacher_read on public.classes
for select
using (public.is_teacher());

create policy classes_student_read on public.classes
for select
using (public.is_student());

-- ------------------------------------------------------------
-- messages
-- ------------------------------------------------------------
drop policy if exists messages_teacher_rw on public.messages;
drop policy if exists messages_student_read on public.messages;
drop policy if exists messages_admin_all on public.messages;

create policy messages_admin_all on public.messages
for all
using (public.is_admin())
with check (public.is_admin());

create policy messages_teacher_rw on public.messages
for all
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

create policy messages_student_read on public.messages
for select
using (
  public.is_student() and (
    target->>'type' = 'all_students'
    or (
      target->>'type' = 'students'
      and (target->'studentIds') ? (auth.uid()::text)
    )
  )
);

-- ------------------------------------------------------------
-- message_reads
-- ------------------------------------------------------------
alter table public.message_reads enable row level security;

drop policy if exists message_reads_admin_all on public.message_reads;
drop policy if exists message_reads_student_rw on public.message_reads;
drop policy if exists message_reads_teacher_read on public.message_reads;

create policy message_reads_admin_all on public.message_reads
for all
using (public.is_admin())
with check (public.is_admin());

create policy message_reads_student_rw on public.message_reads
for all
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy message_reads_teacher_read on public.message_reads
for select
using (
  public.is_teacher() and exists (
    select 1 from public.messages m
    where m.id = message_reads.message_id
      and m.teacher_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- questions
-- ------------------------------------------------------------
drop policy if exists questions_admin_all on public.questions;
drop policy if exists questions_teacher_rw on public.questions;
drop policy if exists questions_student_read_assigned on public.questions;

create policy questions_admin_all on public.questions
for all
using (public.is_admin())
with check (public.is_admin());

create policy questions_teacher_rw on public.questions
for all
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

create policy questions_student_read_assigned on public.questions
for select
using (
  public.is_student() and exists (
    select 1
    from public.exam_questions eq
    join public.exam_assignments ea on ea.exam_id = eq.exam_id
    where eq.question_id = questions.id
      and ea.student_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- exams
-- ------------------------------------------------------------
drop policy if exists exams_admin_all on public.exams;
drop policy if exists exams_teacher_rw on public.exams;
drop policy if exists exams_student_read_assigned on public.exams;

create policy exams_admin_all on public.exams
for all
using (public.is_admin())
with check (public.is_admin());

create policy exams_teacher_rw on public.exams
for all
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

create policy exams_student_read_assigned on public.exams
for select
using (
  public.is_student()
  and status = 'published'
  and exists (
    select 1 from public.exam_assignments ea
    where ea.exam_id = exams.id and ea.student_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- exam_questions
-- ------------------------------------------------------------
drop policy if exists exam_questions_admin_all on public.exam_questions;
drop policy if exists exam_questions_teacher_rw on public.exam_questions;
drop policy if exists exam_questions_student_read on public.exam_questions;

create policy exam_questions_admin_all on public.exam_questions
for all
using (public.is_admin())
with check (public.is_admin());

create policy exam_questions_teacher_rw on public.exam_questions
for all
using (
  exists (
    select 1 from public.exams e
    where e.id = exam_questions.exam_id
      and e.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.exams e
    where e.id = exam_questions.exam_id
      and e.teacher_id = auth.uid()
  )
);

create policy exam_questions_student_read on public.exam_questions
for select
using (
  public.is_student()
  and exists (
    select 1 from public.exam_assignments ea
    where ea.exam_id = exam_questions.exam_id
      and ea.student_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- exam_assignments
-- ------------------------------------------------------------
drop policy if exists exam_assignments_admin_all on public.exam_assignments;
drop policy if exists exam_assignments_teacher_rw on public.exam_assignments;
drop policy if exists exam_assignments_student_read on public.exam_assignments;

create policy exam_assignments_admin_all on public.exam_assignments
for all
using (public.is_admin())
with check (public.is_admin());

create policy exam_assignments_teacher_rw on public.exam_assignments
for all
using (
  exists (
    select 1 from public.exams e
    where e.id = exam_assignments.exam_id
      and e.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.exams e
    where e.id = exam_assignments.exam_id
      and e.teacher_id = auth.uid()
  )
);

create policy exam_assignments_student_read on public.exam_assignments
for select
using (student_id = auth.uid());

-- ------------------------------------------------------------
-- attempts
-- ------------------------------------------------------------
drop policy if exists attempts_admin_all on public.attempts;
drop policy if exists attempts_teacher_read on public.attempts;
drop policy if exists attempts_student_rw on public.attempts;

create policy attempts_admin_all on public.attempts
for all
using (public.is_admin())
with check (public.is_admin());

create policy attempts_teacher_read on public.attempts
for select
using (
  exists (
    select 1 from public.exams e
    where e.id = attempts.exam_id
      and e.teacher_id = auth.uid()
  )
);

create policy attempts_student_rw on public.attempts
for all
using (student_id = auth.uid())
with check (student_id = auth.uid());

-- ------------------------------------------------------------
-- attempt_answers
-- ------------------------------------------------------------
drop policy if exists attempt_answers_admin_all on public.attempt_answers;
drop policy if exists attempt_answers_teacher_rw on public.attempt_answers;
drop policy if exists attempt_answers_student_rw on public.attempt_answers;

create policy attempt_answers_admin_all on public.attempt_answers
for all
using (public.is_admin())
with check (public.is_admin());

create policy attempt_answers_teacher_rw on public.attempt_answers
for all
using (
  exists (
    select 1
    from public.attempts a
    join public.exams e on e.id = a.exam_id
    where a.id = attempt_answers.attempt_id
      and e.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.attempts a
    join public.exams e on e.id = a.exam_id
    where a.id = attempt_answers.attempt_id
      and e.teacher_id = auth.uid()
  )
);

create policy attempt_answers_student_rw on public.attempt_answers
for all
using (
  exists (
    select 1 from public.attempts a
    where a.id = attempt_answers.attempt_id
      and a.student_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.attempts a
    where a.id = attempt_answers.attempt_id
      and a.student_id = auth.uid()
  )
);
