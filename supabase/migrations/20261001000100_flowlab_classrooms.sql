create table if not exists public.flowlab_classrooms (
  id uuid primary key default gen_random_uuid(),
  class_code text not null unique check (class_code ~ '^[A-Z0-9]{6,10}$'),
  teacher_salt text not null,
  teacher_hash text not null,
  class_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.flowlab_classrooms enable row level security;
revoke all on table public.flowlab_classrooms from anon, authenticated, public;
grant all on table public.flowlab_classrooms to service_role;

comment on table public.flowlab_classrooms is
  'Classroom records are accessed only through the FlowLab Edge Function. Never grant direct Data API access to anon or authenticated clients.';
