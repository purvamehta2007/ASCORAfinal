-- ASCORA / EduVerse AI database foundation
create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  grade text,
  language text default 'English',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists curricula (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  name text not null,
  source_filename text,
  created_at timestamptz default now()
);

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid references curricula(id) on delete cascade,
  name text not null
);

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references subjects(id) on delete cascade,
  name text not null
);

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid references units(id) on delete cascade,
  name text not null
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references topics(id) on delete set null,
  concept text,
  difficulty int default 1,
  question_type text default 'short_answer',
  prompt text not null,
  answer_key text,
  created_at timestamptz default now()
);

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  title text not null,
  kind text default 'diagnostic',
  created_at timestamptz default now()
);

create table if not exists assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references assessments(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  score numeric,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists question_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_attempt_id uuid references assessment_attempts(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  question_id uuid references questions(id) on delete set null,
  topic text,
  concept text,
  difficulty int,
  answer text,
  correct boolean,
  time_taken_seconds int,
  attempts int default 1,
  hints_used int default 0,
  answer_changed boolean default false,
  error_type text,
  created_at timestamptz default now()
);

create table if not exists student_mastery (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  topic text not null,
  mastery numeric not null default 0,
  confidence numeric default 0,
  trend text,
  updated_at timestamptz default now(),
  unique(student_id, topic)
);

create table if not exists student_learning_profiles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid unique references profiles(id) on delete cascade,
  pace text default 'moderate',
  visual_support numeric default 0.5,
  examples numeric default 0.5,
  guided_questions numeric default 0.5,
  language text default 'English',
  profile_json jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists student_misconceptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  topic text,
  concept text,
  misconception_type text not null,
  severity text,
  evidence jsonb default '{}'::jsonb,
  resolved boolean default false,
  created_at timestamptz default now()
);

create table if not exists learning_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  ascora_device_id uuid,
  topic text,
  started_at timestamptz default now(),
  ended_at timestamptz
);

create table if not exists learning_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  session_id uuid references learning_sessions(id) on delete set null,
  event_type text not null,
  topic text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists teaching_strategies (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  topic text,
  action text,
  strategy jsonb not null,
  reason text,
  created_at timestamptz default now()
);

create table if not exists lesson_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  topic text,
  strategy_id uuid references teaching_strategies(id) on delete set null,
  content jsonb not null,
  created_at timestamptz default now()
);

create table if not exists ascora_devices (
  id uuid primary key default gen_random_uuid(),
  device_name text not null,
  device_key_hash text,
  status text default 'offline',
  last_seen_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists ascora_sessions (
  id uuid primary key default gen_random_uuid(),
  ascora_device_id uuid references ascora_devices(id) on delete set null,
  student_id uuid references profiles(id) on delete cascade,
  started_at timestamptz default now(),
  ended_at timestamptz
);

create table if not exists ascora_events (
  id uuid primary key default gen_random_uuid(),
  ascora_session_id uuid references ascora_sessions(id) on delete cascade,
  event_type text not null,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  session_id uuid references learning_sessions(id) on delete set null,
  title text,
  content text,
  created_at timestamptz default now()
);

create table if not exists student_notebook_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  session_id uuid references learning_sessions(id) on delete set null,
  question_id uuid references questions(id) on delete set null,
  storage_path text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists classrooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  teacher_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists teacher_student_relationships (
  teacher_id uuid references profiles(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  classroom_id uuid references classrooms(id) on delete cascade,
  primary key (teacher_id, student_id, classroom_id)
);

alter table profiles enable row level security;
alter table curricula enable row level security;
alter table assessments enable row level security;
alter table assessment_attempts enable row level security;
alter table question_attempts enable row level security;
alter table student_mastery enable row level security;
alter table student_learning_profiles enable row level security;
alter table student_misconceptions enable row level security;
alter table learning_sessions enable row level security;
alter table learning_events enable row level security;
alter table teaching_strategies enable row level security;
alter table student_notes enable row level security;
alter table student_notebook_entries enable row level security;

-- Basic student self-access policies.
do $$ begin
  create policy "profiles self read" on profiles for select using (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "profiles self update" on profiles for update using (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "curricula owner access" on curricula for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "mastery self access" on student_mastery for all using (auth.uid() = student_id) with check (auth.uid() = student_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "learning profile self access" on student_learning_profiles for all using (auth.uid() = student_id) with check (auth.uid() = student_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "misconceptions self access" on student_misconceptions for all using (auth.uid() = student_id) with check (auth.uid() = student_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "events self access" on learning_events for all using (auth.uid() = student_id) with check (auth.uid() = student_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "notes self access" on student_notes for all using (auth.uid() = student_id) with check (auth.uid() = student_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "notebook self access" on student_notebook_entries for all using (auth.uid() = student_id) with check (auth.uid() = student_id);
exception when duplicate_object then null; end $$;
