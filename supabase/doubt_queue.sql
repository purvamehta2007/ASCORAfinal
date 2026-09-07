-- ASCORA FIFO doubt queue
--
-- IMPORTANT: this table and its RPCs are referenced throughout the
-- existing codebase (src/pages/Ascora.jsx, hardware/hand_detector.py,
-- hardware/ascora_controller.py) but were never defined in schema.sql.
-- This file is purely additive - it does not alter any existing table.
-- Run this in the Supabase SQL editor in addition to schema.sql.

create table if not exists doubt_queue (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  classroom_id text not null default 'main-classroom',
  status text not null default 'waiting'
    check (status in ('waiting', 'serving', 'resolved', 'cancelled')),
  raised_at timestamptz not null default now(),
  served_at timestamptz,
  resolved_at timestamptz
);

-- Only one active (waiting/serving) request per student per classroom.
create unique index if not exists doubt_queue_one_active_per_student
  on doubt_queue (student_id, classroom_id)
  where status in ('waiting', 'serving');

create index if not exists doubt_queue_classroom_status_idx
  on doubt_queue (classroom_id, status, raised_at);

alter table doubt_queue enable row level security;

-- Students can see the active/resolved queue for their classroom and
-- can insert/update only their own row.
do $$ begin
  create policy "doubt_queue read own classroom"
    on doubt_queue for select
    using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "doubt_queue insert own"
    on doubt_queue for insert
    with check (auth.uid() = student_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "doubt_queue update own (cancel)"
    on doubt_queue for update
    using (auth.uid() = student_id)
    with check (auth.uid() = student_id);
exception when duplicate_object then null; end $$;

-- The physical ASCORA hardware raises hands via hand_detector.py using
-- the anon key (no student session on the device). This mirrors that
-- existing behaviour rather than replacing it - see hardware/hand_detector.py.
do $$ begin
  create policy "doubt_queue hardware insert (anon)"
    on doubt_queue for insert
    to anon
    with check (true);
exception when duplicate_object then null; end $$;

-- --------------------------------------------------
-- claim_next_doubt(): atomically claims the oldest waiting
-- request in a classroom and moves it to 'serving'.
-- Called by hardware/ascora_controller.py with the anon key.
-- --------------------------------------------------

create or replace function claim_next_doubt(p_classroom_id text)
returns doubt_queue
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed doubt_queue;
begin
  select * into claimed
  from doubt_queue
  where classroom_id = p_classroom_id
    and status = 'waiting'
  order by raised_at asc
  for update skip locked
  limit 1;

  if claimed.id is null then
    return null;
  end if;

  update doubt_queue
  set status = 'serving', served_at = now()
  where id = claimed.id
  returning * into claimed;

  return claimed;
end;
$$;

grant execute on function claim_next_doubt(text) to anon, authenticated;

-- --------------------------------------------------
-- resolve_doubt(): the STUDENT-facing resolve path, called from the
-- browser (src/pages/Ascora.jsx) with the student's own session.
-- Only the student who owns the request can resolve it.
-- --------------------------------------------------

create or replace function resolve_doubt(p_request_id uuid)
returns doubt_queue
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved doubt_queue;
begin
  update doubt_queue
  set status = 'resolved', resolved_at = now()
  where id = p_request_id
    and student_id = auth.uid()
    and status = 'serving'
  returning * into resolved;

  if resolved.id is null then
    raise exception 'Request not found, not yours, or not currently serving';
  end if;

  return resolved;
end;
$$;

grant execute on function resolve_doubt(uuid) to authenticated;

-- --------------------------------------------------
-- controller_resolve_doubt(): the HARDWARE-facing resolve path for
-- hardware/ascora_controller.py, which authenticates with the anon
-- key and therefore has no auth.uid() to check ownership against.
-- Scoped to classroom_id instead. NOTE (flagged, not fully solved):
-- anyone holding the anon key + a request UUID can call this, same
-- exposure claim_next_doubt already has. Closing this fully needs a
-- per-device secret, which is out of scope for this migration.
-- --------------------------------------------------

create or replace function controller_resolve_doubt(
  p_request_id uuid,
  p_classroom_id text
)
returns doubt_queue
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved doubt_queue;
begin
  update doubt_queue
  set status = 'resolved', resolved_at = now()
  where id = p_request_id
    and classroom_id = p_classroom_id
    and status = 'serving'
  returning * into resolved;

  if resolved.id is null then
    raise exception 'Request not found or not currently serving';
  end if;

  return resolved;
end;
$$;

grant execute on function controller_resolve_doubt(uuid, text) to anon, authenticated;

-- Realtime updates so the frontend's postgres_changes subscription
-- (src/pages/Ascora.jsx) sees queue changes made by the hardware/RPCs.
do $$ begin
  alter publication supabase_realtime add table doubt_queue;
exception when duplicate_object then null; end $$;
