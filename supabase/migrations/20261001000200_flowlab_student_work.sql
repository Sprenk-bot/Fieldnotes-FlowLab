create table if not exists public.flowlab_student_work (
  class_code text not null references public.flowlab_classrooms(class_code) on delete cascade,
  learner_id text not null,
  work_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (class_code, learner_id)
);

alter table public.flowlab_student_work enable row level security;
revoke all on table public.flowlab_student_work from anon, authenticated, public;
grant all on table public.flowlab_student_work to service_role;

comment on table public.flowlab_student_work is
  'Per-learner work is stored separately so concurrent student saves do not overwrite each other.';
