-- =====================================================================
-- Platform Simulasi Try Out SKD CPNS — skema awal
-- Jalankan sekali di Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Utilitas
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- TABEL
-- ---------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  username       text not null unique check (username ~ '^[a-z0-9_.]{3,32}$'),
  full_name      text not null check (length(trim(full_name)) between 1 and 120),
  role           text not null default 'participant' check (role in ('admin','participant')),
  participant_no integer,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index profiles_role_idx on public.profiles(role);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.exams (
  id               uuid primary key default gen_random_uuid(),
  title            text not null default 'Try Out SKD CPNS Florata Academy',
  description      text,
  start_at         timestamptz,
  end_at           timestamptz,
  timezone         text not null default 'Asia/Jakarta'
                   check (timezone in ('Asia/Jakarta','Asia/Makassar','Asia/Jayapura')),
  duration_minutes integer not null default 100 check (duration_minutes between 1 and 600),
  status           text not null default 'draft' check (status in ('draft','scheduled','open','closed')),
  -- Passing grade WAJIB disesuaikan admin dengan regulasi yang berlaku.
  scoring_config   jsonb not null default jsonb_build_object(
                     'category', 'Umum',
                     'regulation_year', 2024,
                     'regulation_reference', 'Sesuaikan dengan KepmenPANRB yang berlaku',
                     'twk_min', 65,
                     'tiu_min', 80,
                     'tkp_min', 166,
                     'total_min', null),
  opened_at        timestamptz,
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint exams_period_valid check (start_at is null or end_at is null or end_at > start_at)
);

create table public.exam_tokens (
  id          uuid primary key default gen_random_uuid(),
  exam_id     uuid not null references public.exams(id) on delete cascade,
  token_hash  text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index exam_tokens_exam_idx on public.exam_tokens(exam_id, created_at desc);

create table public.questions (
  id              uuid primary key default gen_random_uuid(),
  exam_id         uuid not null references public.exams(id) on delete cascade,
  subtest         text not null check (subtest in ('TWK','TIU','TKP')),
  question_number integer not null,
  question_text   text not null check (length(trim(question_text)) > 0),
  image_url       text check (image_url is null or image_url ~* '^https://'),
  options         jsonb not null,           -- {"A":"..","B":"..","C":"..","D":"..","E":".."}
  correct_answer  char(1) check (correct_answer in ('A','B','C','D','E')),
  tkp_scores      jsonb,                    -- {"A":1..5, ...}
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint questions_number_range check (
       (subtest = 'TWK' and question_number between 1  and 30)
    or (subtest = 'TIU' and question_number between 31 and 65)
    or (subtest = 'TKP' and question_number between 66 and 110))
);
create unique index questions_active_number_uq on public.questions(exam_id, question_number) where is_active;
create index questions_exam_idx on public.questions(exam_id, question_number);

create table public.exam_access (
  exam_id     uuid not null references public.exams(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  verified_at timestamptz not null default now(),
  primary key (exam_id, user_id)
);

create table public.token_attempts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  success    boolean not null,
  created_at timestamptz not null default now()
);
create index token_attempts_user_idx on public.token_attempts(user_id, created_at desc);

create table public.exam_sessions (
  id                 uuid primary key default gen_random_uuid(),
  exam_id            uuid not null references public.exams(id) on delete cascade,
  user_id            uuid not null references public.profiles(id) on delete cascade,
  device_session_id  text,
  last_heartbeat_at  timestamptz,
  started_at         timestamptz not null default now(),
  deadline_at        timestamptz not null,
  submitted_at       timestamptz,
  status             text not null default 'in_progress'
                     check (status in ('in_progress','submitted','timed_out')),
  finalize_reason    text check (finalize_reason in ('submit','timeout','closed')),
  twk_score          integer,
  tiu_score          integer,
  tkp_score          integer,
  total_score        integer,
  correct_count      integer,
  incorrect_count    integer,
  unanswered_count   integer,
  tkp_answered_count integer,
  passed             boolean,
  created_at         timestamptz not null default now(),
  constraint exam_sessions_one_attempt unique (exam_id, user_id)
);
create index exam_sessions_status_idx on public.exam_sessions(exam_id, status);
create index exam_sessions_deadline_idx on public.exam_sessions(deadline_at) where status = 'in_progress';
create index exam_sessions_user_idx on public.exam_sessions(user_id);

create table public.answers (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.exam_sessions(id) on delete cascade,
  question_id     uuid not null references public.questions(id) on delete cascade,
  selected_option char(1) check (selected_option in ('A','B','C','D','E')),
  answered_at     timestamptz not null default now(),   -- waktu perubahan di perangkat (dibatasi <= waktu server)
  updated_at      timestamptz not null default now(),   -- waktu tersimpan di server
  score_obtained  integer,
  constraint answers_one_per_question unique (session_id, question_id)
);
create index answers_question_idx on public.answers(question_id);

create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

-- Satu ujian (aplikasi ini untuk satu kali pelaksanaan)
insert into public.exams (title) values ('Try Out SKD CPNS Florata Academy');

-- ---------------------------------------------------------------------
-- HELPER
-- ---------------------------------------------------------------------
create or replace function public.current_exam_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.exams order by created_at limit 1
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  )
$$;

create or replace function public.write_audit(p_action text, p_target_type text, p_target_id text, p_meta jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs(actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_meta, '{}'::jsonb))
$$;

-- ---------------------------------------------------------------------
-- PENGUNCIAN (trigger)
-- ---------------------------------------------------------------------
create or replace function public.guard_questions()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from public.exams where id = coalesce(new.exam_id, old.exam_id);
  if v_status in ('open','closed') then
    raise exception 'BANK_SOAL_TERKUNCI: soal tidak dapat diubah setelah ujian dibuka';
  end if;
  if tg_op = 'UPDATE' then new.updated_at := now(); end if;
  return coalesce(new, old);
end $$;

create trigger questions_guard before insert or update or delete on public.questions
  for each row execute function public.guard_questions();

create or replace function public.guard_exams()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.exam_status_change', true), '') <> 'on' then
    raise exception 'STATUS_UJIAN_HANYA_LEWAT_FUNGSI';
  end if;
  if old.status in ('open','closed') and (
       new.start_at is distinct from old.start_at
    or new.end_at is distinct from old.end_at
    or new.duration_minutes is distinct from old.duration_minutes
    or new.timezone is distinct from old.timezone
    or new.scoring_config is distinct from old.scoring_config) then
    raise exception 'PENGATURAN_TERKUNCI: jadwal, durasi, dan passing grade terkunci setelah ujian dibuka';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger exams_guard before update on public.exams
  for each row execute function public.guard_exams();

-- ---------------------------------------------------------------------
-- PENILAIAN
-- ---------------------------------------------------------------------
create or replace function public.finalize_session(p_session_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  s        public.exam_sessions%rowtype;
  cfg      jsonb;
  v        record;
  v_total  integer;
  v_passed boolean;
begin
  select * into s from public.exam_sessions where id = p_session_id for update;
  if not found or s.status <> 'in_progress' then
    return;   -- idempotent: sesi yang sudah final tidak dinilai ulang
  end if;

  select scoring_config into cfg from public.exams where id = s.exam_id;

  update public.answers a
     set score_obtained = case
           when a.selected_option is null then 0
           when q.subtest in ('TWK','TIU') then
             case when a.selected_option = q.correct_answer then 5 else 0 end
           else coalesce((q.tkp_scores ->> a.selected_option)::int, 0)
         end
    from public.questions q
   where q.id = a.question_id
     and a.session_id = p_session_id;

  select
    coalesce(sum(a.score_obtained) filter (where q.subtest = 'TWK'), 0)::int as twk,
    coalesce(sum(a.score_obtained) filter (where q.subtest = 'TIU'), 0)::int as tiu,
    coalesce(sum(a.score_obtained) filter (where q.subtest = 'TKP'), 0)::int as tkp,
    count(*) filter (where q.subtest in ('TWK','TIU') and a.selected_option is not null
                       and a.selected_option = q.correct_answer)::int as correct,
    count(*) filter (where q.subtest in ('TWK','TIU') and a.selected_option is not null
                       and a.selected_option is distinct from q.correct_answer)::int as incorrect,
    count(*) filter (where q.subtest = 'TKP' and a.selected_option is not null)::int as tkp_answered,
    count(*) filter (where a.selected_option is null)::int as unanswered
  into v
  from public.questions q
  left join public.answers a on a.question_id = q.id and a.session_id = p_session_id
  where q.exam_id = s.exam_id and q.is_active;

  v_total := v.twk + v.tiu + v.tkp;
  v_passed := v.twk   >= coalesce((cfg ->> 'twk_min')::int, 0)
          and v.tiu   >= coalesce((cfg ->> 'tiu_min')::int, 0)
          and v.tkp   >= coalesce((cfg ->> 'tkp_min')::int, 0)
          and v_total >= coalesce((cfg ->> 'total_min')::int, 0);

  update public.exam_sessions set
    status             = case when p_reason = 'submit' then 'submitted' else 'timed_out' end,
    submitted_at       = case when p_reason = 'timeout' then least(now(), s.deadline_at) else now() end,
    finalize_reason    = p_reason,
    twk_score          = v.twk,
    tiu_score          = v.tiu,
    tkp_score          = v.tkp,
    total_score        = v_total,
    correct_count      = v.correct,
    incorrect_count    = v.incorrect,
    unanswered_count   = v.unanswered,
    tkp_answered_count = v.tkp_answered,
    passed             = v_passed
  where id = p_session_id;
end $$;

create or replace function public.finalize_expired()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in select id from public.exam_sessions
           where status = 'in_progress' and deadline_at <= now() loop
    perform public.finalize_session(r.id, 'timeout');
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- FUNGSI PUBLIK & PESERTA
-- ---------------------------------------------------------------------
create or replace function public.public_exam_info()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'title', title, 'description', description,
    'start_at', start_at, 'end_at', end_at, 'timezone', timezone,
    'duration_minutes', duration_minutes, 'status', status,
    'question_count', 110)
  from public.exams where id = public.current_exam_id()
$$;

create or replace function public.verify_exam_token(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid  uuid := auth.uid();
  v_prof public.profiles%rowtype;
  v_exam public.exams%rowtype;
  v_tok  public.exam_tokens%rowtype;
  v_fail integer;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); end if;

  select * into v_prof from public.profiles where id = v_uid;
  if not found or not v_prof.is_active or v_prof.role <> 'participant' then
    return jsonb_build_object('ok', false, 'error', 'ACCOUNT_INACTIVE');
  end if;

  select count(*) into v_fail from public.token_attempts
   where user_id = v_uid and not success and created_at > now() - interval '10 minutes';
  if v_fail >= 5 then
    return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS');
  end if;

  select * into v_exam from public.exams where id = public.current_exam_id();
  if v_exam.status <> 'open' or v_exam.start_at is null or now() < v_exam.start_at or now() >= v_exam.end_at then
    return jsonb_build_object('ok', false, 'error', 'EXAM_NOT_AVAILABLE');
  end if;

  if exists (select 1 from public.exam_sessions where exam_id = v_exam.id and user_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_STARTED');
  end if;

  select * into v_tok from public.exam_tokens
   where exam_id = v_exam.id order by created_at desc limit 1;

  if not found or not v_tok.is_active
     or v_tok.token_hash <> extensions.crypt(upper(trim(coalesce(p_token, ''))), v_tok.token_hash) then
    insert into public.token_attempts(user_id, success) values (v_uid, false);
    return jsonb_build_object('ok', false, 'error', 'INVALID_TOKEN');
  end if;

  insert into public.token_attempts(user_id, success) values (v_uid, true);
  insert into public.exam_access(exam_id, user_id) values (v_exam.id, v_uid)
    on conflict (exam_id, user_id) do update set verified_at = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.start_exam_session(p_device_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_exam public.exams%rowtype;
  v_id   uuid;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); end if;
  if coalesce(length(p_device_id), 0) < 8 then return jsonb_build_object('ok', false, 'error', 'INVALID_DEVICE'); end if;

  if not exists (select 1 from public.profiles where id = v_uid and is_active and role = 'participant') then
    return jsonb_build_object('ok', false, 'error', 'ACCOUNT_INACTIVE');
  end if;

  select * into v_exam from public.exams where id = public.current_exam_id();
  if v_exam.status <> 'open' or v_exam.start_at is null or now() < v_exam.start_at or now() >= v_exam.end_at then
    return jsonb_build_object('ok', false, 'error', 'EXAM_NOT_AVAILABLE');
  end if;

  if not exists (select 1 from public.exam_access where exam_id = v_exam.id and user_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'TOKEN_REQUIRED');
  end if;

  -- Atomik: unique(exam_id, user_id) menjamin hanya satu sesi per peserta
  insert into public.exam_sessions(exam_id, user_id, device_session_id, last_heartbeat_at, started_at, deadline_at)
  values (v_exam.id, v_uid, p_device_id, now(), now(),
          least(now() + make_interval(mins => v_exam.duration_minutes), v_exam.end_at))
  on conflict (exam_id, user_id) do nothing
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', true, 'existing', true);
  end if;
  return jsonb_build_object('ok', true, 'existing', false, 'session_id', v_id);
end $$;

create or replace function public.get_session_state(p_device_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s     public.exam_sessions%rowtype;
begin
  if v_uid is null then return jsonb_build_object('state', 'unauthenticated'); end if;

  select * into s from public.exam_sessions
   where exam_id = public.current_exam_id() and user_id = v_uid
   for update;
  if not found then return jsonb_build_object('state', 'none'); end if;

  if s.status = 'in_progress' and s.deadline_at <= now() then
    perform public.finalize_session(s.id, 'timeout');
    select * into s from public.exam_sessions where id = s.id;
  end if;
  if s.status <> 'in_progress' then
    return jsonb_build_object('state', 'finished', 'session_id', s.id);
  end if;

  if not exists (select 1 from public.profiles where id = v_uid and is_active) then
    return jsonb_build_object('state', 'inactive');
  end if;

  if s.device_session_id is distinct from p_device_id then
    -- Perangkat lain masih aktif (heartbeat < 90 detik) -> tolak
    if s.last_heartbeat_at is not null and s.last_heartbeat_at > now() - interval '90 seconds' then
      return jsonb_build_object('state', 'locked');
    end if;
    update public.exam_sessions
       set device_session_id = p_device_id, last_heartbeat_at = now()
     where id = s.id;
  else
    update public.exam_sessions set last_heartbeat_at = now() where id = s.id;
  end if;

  return jsonb_build_object(
    'state', 'active',
    'session_id', s.id,
    'started_at', s.started_at,
    'deadline_at', s.deadline_at,
    'server_now', now(),
    'exam_title', (select title from public.exams where id = s.exam_id),
    'answers', coalesce((
      select jsonb_object_agg(question_id::text, selected_option)
        from public.answers
       where session_id = s.id and selected_option is not null), '{}'::jsonb));
end $$;

create or replace function public.get_exam_questions(p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_exam uuid;
begin
  select exam_id into v_exam from public.exam_sessions
   where id = p_session_id and user_id = auth.uid()
     and status = 'in_progress' and deadline_at > now();
  if v_exam is null then
    raise exception 'SESSION_NOT_ACTIVE';
  end if;

  -- Tanpa kunci jawaban dan tanpa bobot TKP
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', id, 'subtest', subtest, 'number', question_number,
             'text', question_text, 'image_url', image_url, 'options', options)
           order by question_number)
      from public.questions
     where exam_id = v_exam and is_active), '[]'::jsonb);
end $$;

create or replace function public.save_answers(p_session_id uuid, p_device_id text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s       public.exam_sessions%rowtype;
  v_count integer;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); end if;

  select * into s from public.exam_sessions
   where id = p_session_id and user_id = auth.uid()
   for no key update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;

  if s.status <> 'in_progress' then
    return jsonb_build_object('ok', false, 'error', 'SESSION_CLOSED');
  end if;
  if s.deadline_at <= now() then
    perform public.finalize_session(s.id, 'timeout');
    return jsonb_build_object('ok', false, 'error', 'SESSION_CLOSED');
  end if;
  if s.device_session_id is distinct from p_device_id then
    return jsonb_build_object('ok', false, 'error', 'DEVICE_MISMATCH');
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 110 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_PAYLOAD');
  end if;

  -- Upsert idempotent; perubahan yang lebih lama tidak menimpa yang lebih baru
  insert into public.answers(session_id, question_id, selected_option, answered_at, updated_at)
  select p_session_id, x.qid, x.opt, x.ts, now()
  from (
    select distinct on ((i ->> 'question_id')::uuid)
           (i ->> 'question_id')::uuid as qid,
           nullif(i ->> 'option', '') as opt,
           least(coalesce((i ->> 'client_ts')::timestamptz, now()), now()) as ts
      from jsonb_array_elements(p_items) i
     order by (i ->> 'question_id')::uuid,
              coalesce((i ->> 'client_ts')::timestamptz, now()) desc
  ) x
  join public.questions q on q.id = x.qid and q.exam_id = s.exam_id and q.is_active
  where x.opt is null or x.opt in ('A','B','C','D','E')
  on conflict (session_id, question_id) do update
     set selected_option = excluded.selected_option,
         answered_at     = excluded.answered_at,
         updated_at      = now()
   where public.answers.answered_at <= excluded.answered_at;
  get diagnostics v_count = row_count;

  update public.exam_sessions set last_heartbeat_at = now() where id = s.id;
  return jsonb_build_object('ok', true, 'saved', v_count, 'server_now', now());
end $$;

create or replace function public.heartbeat(p_session_id uuid, p_device_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.exam_sessions%rowtype;
begin
  select * into s from public.exam_sessions
   where id = p_session_id and user_id = auth.uid()
   for no key update;
  if not found then return jsonb_build_object('status', 'not_found', 'server_now', now()); end if;

  if s.status = 'in_progress' and s.deadline_at <= now() then
    perform public.finalize_session(s.id, 'timeout');
    return jsonb_build_object('status', 'finished', 'server_now', now());
  end if;
  if s.status <> 'in_progress' then
    return jsonb_build_object('status', 'finished', 'server_now', now());
  end if;
  if s.device_session_id is distinct from p_device_id then
    return jsonb_build_object('status', 'in_progress', 'device_ok', false, 'server_now', now());
  end if;

  update public.exam_sessions set last_heartbeat_at = now() where id = s.id;
  return jsonb_build_object('status', 'in_progress', 'device_ok', true,
                            'deadline_at', s.deadline_at, 'server_now', now());
end $$;

create or replace function public.submit_exam(p_session_id uuid, p_device_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.exam_sessions%rowtype;
begin
  select * into s from public.exam_sessions
   where id = p_session_id and user_id = auth.uid()
   for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;

  if s.status = 'in_progress' then
    if s.device_session_id is distinct from p_device_id
       and s.last_heartbeat_at is not null
       and s.last_heartbeat_at > now() - interval '90 seconds' then
      return jsonb_build_object('ok', false, 'error', 'DEVICE_MISMATCH');
    end if;
    perform public.finalize_session(s.id,
      case when s.deadline_at <= now() then 'timeout' else 'submit' end);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.get_my_result()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s     public.exam_sessions%rowtype;
  e     public.exams%rowtype;
  p     public.profiles%rowtype;
begin
  if v_uid is null then return null; end if;
  select * into s from public.exam_sessions
   where exam_id = public.current_exam_id() and user_id = v_uid;
  if not found then return null; end if;

  if s.status = 'in_progress' and s.deadline_at <= now() then
    perform public.finalize_session(s.id, 'timeout');
    select * into s from public.exam_sessions where id = s.id;
  end if;

  select * into e from public.exams where id = s.exam_id;
  select * into p from public.profiles where id = v_uid;

  return jsonb_build_object(
    'status', s.status,
    'full_name', p.full_name, 'username', p.username,
    'exam_title', e.title, 'timezone', e.timezone,
    'started_at', s.started_at, 'submitted_at', s.submitted_at, 'deadline_at', s.deadline_at,
    'finalize_reason', s.finalize_reason,
    'twk_score', s.twk_score, 'tiu_score', s.tiu_score, 'tkp_score', s.tkp_score,
    'total_score', s.total_score,
    'correct_count', s.correct_count, 'incorrect_count', s.incorrect_count,
    'unanswered_count', s.unanswered_count, 'tkp_answered_count', s.tkp_answered_count,
    'passed', s.passed,
    'scoring_config', e.scoring_config);
end $$;

-- ---------------------------------------------------------------------
-- FUNGSI ADMIN (semua memeriksa is_admin())
-- ---------------------------------------------------------------------
create or replace function public.admin_set_token(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_exam uuid := public.current_exam_id(); v_id uuid;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_token is null or length(trim(p_token)) < 4 or length(trim(p_token)) > 32 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TOKEN_FORMAT');
  end if;
  update public.exam_tokens set is_active = false, updated_at = now() where exam_id = v_exam and is_active;
  insert into public.exam_tokens(exam_id, token_hash, is_active)
  values (v_exam, extensions.crypt(upper(trim(p_token)), extensions.gen_salt('bf', 8)), true)
  returning id into v_id;
  perform public.write_audit('token.regenerate', 'exam', v_exam::text, '{}'::jsonb);
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.admin_set_token_active(p_active boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select id into v_id from public.exam_tokens
   where exam_id = public.current_exam_id() order by created_at desc limit 1;
  if v_id is null then return jsonb_build_object('ok', false, 'error', 'NO_TOKEN'); end if;
  update public.exam_tokens set is_active = p_active, updated_at = now() where id = v_id;
  perform public.write_audit(case when p_active then 'token.activate' else 'token.deactivate' end,
                             'exam_token', v_id::text, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_token_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t public.exam_tokens%rowtype;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into t from public.exam_tokens
   where exam_id = public.current_exam_id() order by created_at desc limit 1;
  if not found then return jsonb_build_object('exists', false); end if;
  return jsonb_build_object('exists', true, 'is_active', t.is_active,
                            'created_at', t.created_at, 'updated_at', t.updated_at);
end $$;

create or replace function public.admin_validate_exam()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e        public.exams%rowtype;
  errs     text[] := '{}';
  v_count  integer;
  v_list   text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into e from public.exams where id = public.current_exam_id();

  if e.start_at is null or e.end_at is null then
    errs := array_append(errs, 'Jadwal mulai dan berakhir belum diisi.'::text);
  elsif e.end_at <= e.start_at then
    errs := array_append(errs, 'Waktu berakhir harus setelah waktu mulai.'::text);
  elsif e.end_at <= now() then
    errs := array_append(errs, 'Waktu berakhir sudah lewat.'::text);
  end if;

  select count(*) into v_count from public.questions where exam_id = e.id and is_active;
  if v_count <> 110 then
    errs := array_append(errs, format('Jumlah soal aktif %s, harus tepat 110.', v_count)::text);
  end if;

  select string_agg(n::text, ', ' order by n) into v_list
    from generate_series(1, 110) n
   where not exists (select 1 from public.questions
                      where exam_id = e.id and is_active and question_number = n);
  if v_list is not null then
    errs := array_append(errs, ('Nomor soal belum terisi: ' || v_list)::text);
  end if;

  select string_agg(question_number::text, ', ' order by question_number) into v_list
    from public.questions
   where exam_id = e.id and is_active and subtest in ('TWK','TIU') and correct_answer is null;
  if v_list is not null then errs := array_append(errs, ('Soal TWK/TIU tanpa kunci jawaban: ' || v_list)::text); end if;

  select string_agg(distinct q.question_number::text, ', ') into v_list
    from public.questions q
    cross join unnest(array['A','B','C','D','E']) k
   where q.exam_id = e.id and q.is_active
     and coalesce(trim(q.options ->> k), '') = '';
  if v_list is not null then errs := array_append(errs, ('Soal dengan pilihan A–E belum lengkap: ' || v_list)::text); end if;

  select string_agg(distinct q.question_number::text, ', ') into v_list
    from public.questions q
    cross join unnest(array['A','B','C','D','E']) k
   where q.exam_id = e.id and q.is_active and q.subtest = 'TKP'
     and (q.tkp_scores is null
          or jsonb_typeof(q.tkp_scores -> k) <> 'number'
          or (q.tkp_scores ->> k)::numeric not in (1,2,3,4,5));
  if v_list is not null then errs := array_append(errs, ('Soal TKP dengan bobot tidak valid (harus 1–5): ' || v_list)::text); end if;

  if not exists (select 1 from public.exam_tokens where exam_id = e.id and is_active) then
    errs := array_append(errs, 'Token ujian aktif belum dibuat.'::text);
  end if;

  return to_jsonb(errs);
end $$;

create or replace function public.admin_open_exam()
returns jsonb language plpgsql security definer set search_path = public as $$
declare errs jsonb; v_exam uuid := public.current_exam_id();
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if (select status from public.exams where id = v_exam) = 'closed' then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_array('Ujian sudah ditutup.'));
  end if;
  errs := public.admin_validate_exam();
  if jsonb_array_length(errs) > 0 then
    return jsonb_build_object('ok', false, 'errors', errs);
  end if;
  perform set_config('app.exam_status_change', 'on', true);
  update public.exams set status = 'open', opened_at = now() where id = v_exam;
  perform set_config('app.exam_status_change', 'off', true);
  perform public.write_audit('exam.open', 'exam', v_exam::text, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_close_exam()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_exam uuid := public.current_exam_id(); r record; n integer := 0;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  perform set_config('app.exam_status_change', 'on', true);
  update public.exams set status = 'closed', closed_at = now() where id = v_exam;
  perform set_config('app.exam_status_change', 'off', true);

  for r in select id, deadline_at from public.exam_sessions
           where exam_id = v_exam and status = 'in_progress' loop
    perform public.finalize_session(r.id, case when r.deadline_at <= now() then 'timeout' else 'closed' end);
    n := n + 1;
  end loop;

  perform public.write_audit('exam.close', 'exam', v_exam::text, jsonb_build_object('finalized_sessions', n));
  return jsonb_build_object('ok', true, 'finalized', n);
end $$;

create or replace function public.admin_unlock_exam()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_exam uuid := public.current_exam_id();
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if exists (select 1 from public.exam_sessions where exam_id = v_exam) then
    return jsonb_build_object('ok', false, 'error', 'SUDAH_ADA_PESERTA_MEMULAI');
  end if;
  perform set_config('app.exam_status_change', 'on', true);
  update public.exams set status = 'draft', opened_at = null, closed_at = null where id = v_exam;
  perform set_config('app.exam_status_change', 'off', true);
  perform public.write_audit('exam.unlock', 'exam', v_exam::text, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_release_device(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.exam_sessions
     set device_session_id = null, last_heartbeat_at = null
   where id = p_session_id and status = 'in_progress';
  perform public.write_audit('session.release_device', 'exam_session', p_session_id::text, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_list_participants()
returns table (
  id uuid, participant_no integer, full_name text, username text, is_active boolean,
  created_at timestamptz, session_id uuid, exam_status text,
  started_at timestamptz, deadline_at timestamptz, submitted_at timestamptz,
  twk_score integer, tiu_score integer, tkp_score integer, total_score integer,
  correct_count integer, incorrect_count integer, unanswered_count integer,
  tkp_answered_count integer, passed boolean, last_heartbeat_at timestamptz,
  finalize_reason text)
language plpgsql security definer set search_path = public as $$
declare e public.exams%rowtype; v_ended boolean;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  perform public.finalize_expired();
  select * into e from public.exams x where x.id = public.current_exam_id();
  v_ended := e.status = 'closed' or (e.end_at is not null and now() >= e.end_at);

  return query
  select p.id, p.participant_no, p.full_name, p.username, p.is_active, p.created_at,
         s.id,
         case
           when s.id is null then case when v_ended then 'not_participating' else 'not_started' end
           else s.status
         end,
         s.started_at, s.deadline_at, s.submitted_at,
         s.twk_score, s.tiu_score, s.tkp_score, s.total_score,
         s.correct_count, s.incorrect_count, s.unanswered_count,
         s.tkp_answered_count, s.passed, s.last_heartbeat_at, s.finalize_reason
    from public.profiles p
    left join public.exam_sessions s on s.user_id = p.id and s.exam_id = e.id
   where p.role = 'participant'
   order by p.participant_no nulls last, p.full_name;
end $$;

create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  with p as (select * from public.admin_list_participants()),
       f as (select * from p where exam_status in ('submitted','timed_out'))
  select jsonb_build_object(
    'total_participants', (select count(*) from p),
    'active_accounts',    (select count(*) from p where is_active),
    'not_started',        (select count(*) from p where exam_status = 'not_started'),
    'in_progress',        (select count(*) from p where exam_status = 'in_progress'),
    'finished',           (select count(*) from f),
    'timed_out',          (select count(*) from p where exam_status = 'timed_out'),
    'not_participating',  (select count(*) from p where exam_status = 'not_participating'),
    'total_questions',    (select count(*) from public.questions
                            where exam_id = public.current_exam_id() and is_active),
    'avg_total',  (select round(avg(total_score)::numeric, 1) from f),
    'max_total',  (select max(total_score) from f),
    'min_total',  (select min(total_score) from f),
    'avg_twk',    (select round(avg(twk_score)::numeric, 1) from f),
    'avg_tiu',    (select round(avg(tiu_score)::numeric, 1) from f),
    'avg_tkp',    (select round(avg(tkp_score)::numeric, 1) from f),
    'passed',     (select count(*) from f where passed),
    'server_now', now())
  into r;
  return r;
end $$;

create or replace function public.admin_delete_exam_results()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_exam uuid := public.current_exam_id(); n integer;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select count(*) into n from public.exam_sessions where exam_id = v_exam;
  delete from public.exam_sessions where exam_id = v_exam;   -- answers ikut terhapus (cascade)
  delete from public.exam_access   where exam_id = v_exam;
  delete from public.token_attempts;
  perform set_config('app.exam_status_change', 'on', true);
  update public.exams set status = 'draft', opened_at = null, closed_at = null where id = v_exam;
  perform set_config('app.exam_status_change', 'off', true);
  perform public.write_audit('data.delete_results', 'exam', v_exam::text, jsonb_build_object('sessions_deleted', n));
  return jsonb_build_object('ok', true, 'sessions_deleted', n);
end $$;

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.exams          enable row level security;
alter table public.exam_tokens    enable row level security;
alter table public.questions      enable row level security;
alter table public.exam_access    enable row level security;
alter table public.token_attempts enable row level security;
alter table public.exam_sessions  enable row level security;
alter table public.answers        enable row level security;
alter table public.audit_logs     enable row level security;

-- profiles: peserta hanya profil sendiri; admin semua
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_admin_write on public.profiles for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- exams: semua pengguna login boleh membaca info ujian; hanya admin mengubah
create policy exams_select on public.exams for select to authenticated using (true);
create policy exams_admin_update on public.exams for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- exam_tokens: hanya admin (hash saja)
create policy exam_tokens_admin_select on public.exam_tokens for select to authenticated
  using ((select public.is_admin()));

-- questions: HANYA admin (peserta membaca soal lewat get_exam_questions tanpa kunci)
create policy questions_admin_all on public.questions for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy exam_access_select on public.exam_access for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy token_attempts_admin_select on public.token_attempts for select to authenticated
  using ((select public.is_admin()));

-- exam_sessions: baca milik sendiri; TIDAK ADA kebijakan insert/update untuk peserta
create policy exam_sessions_select on public.exam_sessions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- answers: baca milik sendiri; tulis hanya lewat save_answers()
create policy answers_select on public.answers for select to authenticated
  using ((select public.is_admin()) or exists (
    select 1 from public.exam_sessions s
     where s.id = answers.session_id and s.user_id = (select auth.uid())));

create policy audit_logs_admin_select on public.audit_logs for select to authenticated
  using ((select public.is_admin()));
create policy audit_logs_admin_insert on public.audit_logs for insert to authenticated
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- HAK EKSEKUSI FUNGSI
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public;
do $$ begin
  execute 'revoke execute on all functions in schema public from anon';
  execute 'revoke execute on all functions in schema public from authenticated';
exception when undefined_object then null; end $$;

grant execute on function public.public_exam_info()                   to anon, authenticated;
grant execute on function public.is_admin()                           to authenticated;
grant execute on function public.current_exam_id()                    to authenticated;
grant execute on function public.verify_exam_token(text)              to authenticated;
grant execute on function public.start_exam_session(text)             to authenticated;
grant execute on function public.get_session_state(text)              to authenticated;
grant execute on function public.get_exam_questions(uuid)             to authenticated;
grant execute on function public.save_answers(uuid, text, jsonb)      to authenticated;
grant execute on function public.heartbeat(uuid, text)                to authenticated;
grant execute on function public.submit_exam(uuid, text)              to authenticated;
grant execute on function public.get_my_result()                      to authenticated;
grant execute on function public.admin_set_token(text)                to authenticated;
grant execute on function public.admin_set_token_active(boolean)      to authenticated;
grant execute on function public.admin_token_status()                 to authenticated;
grant execute on function public.admin_validate_exam()                to authenticated;
grant execute on function public.admin_open_exam()                    to authenticated;
grant execute on function public.admin_close_exam()                   to authenticated;
grant execute on function public.admin_unlock_exam()                  to authenticated;
grant execute on function public.admin_release_device(uuid)           to authenticated;
grant execute on function public.admin_list_participants()            to authenticated;
grant execute on function public.admin_dashboard_stats()              to authenticated;
grant execute on function public.admin_delete_exam_results()          to authenticated;
-- finalize_session, finalize_expired, write_audit: TIDAK diberikan ke klien
