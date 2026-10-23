-- APPLY ONLY WITH JOEL'S APPROVAL, after the code deploy.
-- App Admin analytics: anonymous quiz-session tracking + admin-only aggregate summary.
-- Guests are a random device id (no name/email/IP). Tables are reachable only through the
-- service-role API routes: RLS on with no policies, all grants revoked.
begin;

create table if not exists public.analytics_quiz_sessions (
  id uuid primary key,
  user_id uuid null references auth.users(id) on delete cascade,
  device_id uuid not null,
  mode text not null check (mode in ('topic','paper','random','review','mistakes','drill','homework','custom','replay')),
  subject text,
  source_ref text,
  planned_length int null,
  is_timed boolean not null default false,
  device_type text not null check (device_type in ('phone','tablet','desktop','unknown')),
  answered_count int not null default 0,
  first_correct_count int not null default 0,
  retry_correct_count int not null default 0,
  wrong_count int not null default 0,
  timeout_count int not null default 0,
  first_wrong_count int not null default 0,
  total_time_ms bigint not null default 0,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz null,
  ended_early boolean not null default false
);
create index if not exists analytics_quiz_sessions_started_idx on public.analytics_quiz_sessions (started_at);
create index if not exists analytics_quiz_sessions_user_idx on public.analytics_quiz_sessions (user_id);
create index if not exists analytics_quiz_sessions_device_idx on public.analytics_quiz_sessions (device_id, started_at);

create table if not exists public.analytics_session_questions (
  session_id uuid not null references public.analytics_quiz_sessions(id) on delete cascade,
  question_id text not null,
  final_recorded boolean not null default false,
  primary key (session_id, question_id)
);

create table if not exists public.analytics_question_daily (
  question_id text not null,
  day date not null,
  attempts int not null default 0,
  first_correct int not null default 0,
  retry_correct int not null default 0,
  wrong int not null default 0,
  timeouts int not null default 0,
  total_time_ms bigint not null default 0,
  pick_a int not null default 0,
  pick_b int not null default 0,
  pick_c int not null default 0,
  pick_d int not null default 0,
  primary key (question_id, day)
);

alter table public.analytics_quiz_sessions enable row level security;
alter table public.analytics_session_questions enable row level security;
alter table public.analytics_question_daily enable row level security;
revoke all on public.analytics_quiz_sessions from anon, authenticated;
revoke all on public.analytics_session_questions from anon, authenticated;
revoke all on public.analytics_question_daily from anon, authenticated;

-- Records one answer event for an owned session. Idempotent per (session, question).
create or replace function public.analytics_record_answer(
  p_session_id uuid, p_user_id uuid, p_device_id uuid, p_question_id text,
  p_attempt int, p_option text, p_outcome text, p_is_final boolean, p_time_ms int
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owned boolean;
  v_new boolean;
  v_final_done boolean;
  v_day date := (now() at time zone 'Asia/Singapore')::date;
  v_ms bigint := least(greatest(coalesce(p_time_ms, 0), 0), 600000);
  v_staff boolean := false;
  v_fc int := 0; v_rc int := 0; v_w int := 0; v_t int := 0; v_fw int := 0;
  v_opt text := upper(coalesce(p_option, ''));
begin
  select true into v_owned from analytics_quiz_sessions s
   where s.id = p_session_id
     and ((p_user_id is not null and s.user_id = p_user_id)
       or (s.user_id is null and p_user_id is null and s.device_id = p_device_id));
  if v_owned is not true then return; end if;

  if p_user_id is not null then
    select exists(select 1 from profiles where id = p_user_id and role in ('teacher','admin')) into v_staff;
  end if;

  insert into analytics_session_questions (session_id, question_id)
  values (p_session_id, p_question_id)
  on conflict do nothing;
  get diagnostics v_new = row_count;

  if v_new and p_attempt = 1 and v_opt in ('A','B','C','D') and not v_staff then
    insert into analytics_question_daily (question_id, day, pick_a, pick_b, pick_c, pick_d)
    values (p_question_id, v_day,
      (v_opt = 'A')::int, (v_opt = 'B')::int, (v_opt = 'C')::int, (v_opt = 'D')::int)
    on conflict (question_id, day) do update set
      pick_a = analytics_question_daily.pick_a + excluded.pick_a,
      pick_b = analytics_question_daily.pick_b + excluded.pick_b,
      pick_c = analytics_question_daily.pick_c + excluded.pick_c,
      pick_d = analytics_question_daily.pick_d + excluded.pick_d;
  end if;

  if p_is_final then
    update analytics_session_questions set final_recorded = true
     where session_id = p_session_id and question_id = p_question_id and final_recorded = false
     returning true into v_final_done;
    if v_final_done is true then
      v_fc := (p_outcome = 'first-correct')::int;
      v_rc := (p_outcome = 'retry-correct')::int;
      v_w  := (p_outcome = 'wrong')::int;
      v_t  := (p_outcome = 'timeout')::int;
      v_fw := (p_attempt = 2)::int; -- a second attempt only exists after a wrong first attempt
      update analytics_quiz_sessions set
        answered_count = answered_count + 1,
        first_correct_count = first_correct_count + v_fc,
        retry_correct_count = retry_correct_count + v_rc,
        wrong_count = wrong_count + v_w,
        timeout_count = timeout_count + v_t,
        first_wrong_count = first_wrong_count + v_fw,
        total_time_ms = total_time_ms + v_ms
       where id = p_session_id;
      if not v_staff then
        insert into analytics_question_daily (question_id, day, attempts, first_correct, retry_correct, wrong, timeouts, total_time_ms)
        values (p_question_id, v_day, 1, v_fc, v_rc, v_w, v_t, v_ms)
        on conflict (question_id, day) do update set
          attempts = analytics_question_daily.attempts + 1,
          first_correct = analytics_question_daily.first_correct + excluded.first_correct,
          retry_correct = analytics_question_daily.retry_correct + excluded.retry_correct,
          wrong = analytics_question_daily.wrong + excluded.wrong,
          timeouts = analytics_question_daily.timeouts + excluded.timeouts,
          total_time_ms = analytics_question_daily.total_time_ms + excluded.total_time_ms;
      end if;
    end if;
  end if;

  update analytics_quiz_sessions set last_activity_at = now() where id = p_session_id;
end;
$$;

create or replace function public.admin_analytics_summary(p_from timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tz constant text := 'Asia/Singapore';
  v_now timestamptz := now();
  v_today date := (now() at time zone 'Asia/Singapore')::date;
  v_since timestamptz;
  v_from_day date;
  v_start_day date;
  v_users jsonb; v_quizzes jsonb; v_answers jsonb;
  v_daily jsonb; v_heat jsonb; v_ret jsonb; v_topics jsonb; v_papers jsonb;
  v_hard jsonb; v_slow jsonb;
  v_active_today int; v_active_7 int; v_active_30 int; v_guests int;
begin
  create temp table if not exists _aa_s (like analytics_quiz_sessions) on commit drop;
  truncate _aa_s;
  -- all non-staff sessions, with learner key
  create temp table if not exists _aa_all on commit drop as select * from analytics_quiz_sessions where false;
  truncate _aa_all;
  insert into _aa_all
    select s.* from analytics_quiz_sessions s
     where not exists (select 1 from profiles p where p.id = s.user_id and p.role in ('teacher','admin'));
  insert into _aa_s select * from _aa_all where p_from is null or started_at >= p_from;

  select min(started_at) into v_since from analytics_quiz_sessions;
  v_from_day := case when p_from is null then null else (p_from at time zone tz)::date end;

  select count(distinct coalesce(user_id::text, 'd:' || device_id::text)) filter (where (started_at at time zone tz)::date = v_today),
         count(distinct coalesce(user_id::text, 'd:' || device_id::text)) filter (where started_at >= v_now - interval '7 days'),
         count(distinct coalesce(user_id::text, 'd:' || device_id::text)) filter (where started_at >= v_now - interval '30 days')
    into v_active_today, v_active_7, v_active_30
    from _aa_all;
  select count(distinct device_id) into v_guests from _aa_s where user_id is null;

  v_users := jsonb_build_object(
    'registered', (select count(*) from profiles),
    'students', (select count(*) from profiles where role = 'student'),
    'teachers', (select count(*) from profiles where role = 'teacher'),
    'admins', (select count(*) from profiles where role = 'admin'),
    'schoolAccounts', (select count(*) from profiles where is_school_account),
    'individualAccounts', (select count(*) from profiles where not coalesce(is_school_account, false)),
    'newSignups', (select count(*) from profiles where p_from is null or created_at >= p_from),
    'guestDevices', v_guests,
    'activeToday', v_active_today,
    'active7d', v_active_7,
    'active30d', v_active_30,
    'stickiness', case when v_active_30 > 0 then round(v_active_today::numeric / v_active_30, 4) end,
    'streakBuckets', (
      select jsonb_agg(jsonb_build_object('label', b.label, 'count', coalesce(c.n, 0)) order by b.ord)
        from (values ('0',1),('1-2',2),('3-6',3),('7-29',4),('30+',5)) b(label, ord)
        left join (
          select case when coalesce(current_streak,0) <= 0 then '0'
                      when current_streak <= 2 then '1-2'
                      when current_streak <= 6 then '3-6'
                      when current_streak <= 29 then '7-29' else '30+' end as label, count(*) n
            from profiles where role = 'student' group by 1
        ) c on c.label = b.label
    )
  );

  v_quizzes := (
    with t as (
      select count(*) started,
             count(*) filter (where completed_at is not null and not ended_early) completed,
             count(*) filter (where completed_at is not null and ended_early) ended_early,
             count(*) filter (where completed_at is null and last_activity_at < v_now - interval '30 minutes') abandoned,
             count(*) filter (where completed_at is null and last_activity_at >= v_now - interval '30 minutes') in_progress,
             avg(answered_count) avg_ans,
             avg(extract(epoch from (completed_at - started_at))) filter (where completed_at is not null) avg_sec,
             count(*) filter (where is_timed) timed
        from _aa_s
    )
    select jsonb_build_object(
      'started', started, 'completed', completed, 'endedEarly', ended_early,
      'abandoned', abandoned, 'inProgress', in_progress,
      'completionRate', case when started > 0 then round(completed::numeric / started, 4) end,
      'avgAnsweredPerSession', round(avg_ans::numeric, 1),
      'avgSessionSeconds', round(avg_sec::numeric, 1),
      'timedShare', case when started > 0 then round(timed::numeric / started, 4) end,
      'byMode', coalesce((select jsonb_agg(jsonb_build_object('key', mode, 'started', n, 'completed', c) order by n desc)
                  from (select mode, count(*) n, count(*) filter (where completed_at is not null and not ended_early) c from _aa_s group by mode) m), '[]'::jsonb),
      'byDevice', coalesce((select jsonb_agg(jsonb_build_object('key', device_type, 'sessions', n) order by n desc)
                  from (select device_type, count(*) n from _aa_s group by device_type) d), '[]'::jsonb)
    ) from t
  );

  v_answers := (
    with t as (
      select coalesce(sum(answered_count),0) total, coalesce(sum(first_correct_count),0) fc,
             coalesce(sum(retry_correct_count),0) rc, coalesce(sum(first_wrong_count),0) fw,
             coalesce(sum(timeout_count),0) tmo, coalesce(sum(total_time_ms),0) ms,
             percentile_cont(0.5) within group (order by total_time_ms::numeric / answered_count / 1000)
               filter (where answered_count > 0) med
        from _aa_s
    )
    select jsonb_build_object(
      'total', total,
      'firstTryAccuracy', case when total > 0 then round(fc::numeric / total, 4) end,
      'retryRecoveryRate', case when fw > 0 then round(rc::numeric / fw, 4) end,
      'timeoutRate', case when total > 0 then round(tmo::numeric / total, 4) end,
      'avgAnswerSeconds', case when total > 0 then round(ms::numeric / total / 1000, 1) end,
      'medianSessionAnswerSeconds', round(med::numeric, 1)
    ) from t
  );

  v_start_day := greatest(v_today - 179,
                          coalesce(v_from_day, (v_since at time zone tz)::date, v_today));
  v_daily := coalesce((
    select jsonb_agg(jsonb_build_object(
      'day', to_char(g.d, 'YYYY-MM-DD'),
      'activeLearners', coalesce(x.learners, 0),
      'sessionsStarted', coalesce(x.started, 0),
      'sessionsCompleted', coalesce(x.completed, 0),
      'answers', coalesce(x.answers, 0),
      'firstTryAccuracy', case when coalesce(x.answers, 0) > 0 then round(x.fc::numeric / x.answers, 4) end
    ) order by g.d)
    from generate_series(v_start_day, v_today, interval '1 day') as g(d)
    left join (
      select (started_at at time zone tz)::date d,
             count(distinct coalesce(user_id::text, 'd:' || device_id::text)) learners,
             count(*) started,
             count(*) filter (where completed_at is not null and not ended_early) completed,
             sum(answered_count) answers, sum(first_correct_count) fc
        from _aa_s group by 1
    ) x on x.d = g.d::date
  ), '[]'::jsonb);

  v_heat := coalesce((
    select jsonb_agg(jsonb_build_object('weekday', wd, 'hour', hr, 'sessions', n) order by wd, hr)
      from (select (extract(isodow from started_at at time zone tz)::int - 1) wd,
                   extract(hour from started_at at time zone tz)::int hr, count(*) n
              from _aa_s group by 1, 2) h
  ), '[]'::jsonb);

  v_ret := coalesce((
    with l as (
      select coalesce(user_id::text, 'd:' || device_id::text) k,
             date_trunc('week', started_at at time zone tz)::date wk
        from _aa_all group by 1, 2
    ), f as (select k, min(wk) first_wk from l group by k),
    cw as (
      select (date_trunc('week', v_now at time zone tz)::date - 7 * g) c
        from generate_series(0, 7) g
    )
    select jsonb_agg(jsonb_build_object(
      'cohortWeek', to_char(cw.c, 'YYYY-MM-DD'),
      'size', (select count(*) from f where f.first_wk = cw.c),
      'week1', r.w1, 'week2', r.w2, 'week3', r.w3, 'week4', r.w4) order by cw.c)
    from cw
    cross join lateral (
      select
        case when cw.c + 7 > v_today or sz.n = 0 then null else round((select count(*) from f join l on l.k = f.k and l.wk = cw.c + 7 where f.first_wk = cw.c)::numeric / sz.n, 4) end w1,
        case when cw.c + 14 > v_today or sz.n = 0 then null else round((select count(*) from f join l on l.k = f.k and l.wk = cw.c + 14 where f.first_wk = cw.c)::numeric / sz.n, 4) end w2,
        case when cw.c + 21 > v_today or sz.n = 0 then null else round((select count(*) from f join l on l.k = f.k and l.wk = cw.c + 21 where f.first_wk = cw.c)::numeric / sz.n, 4) end w3,
        case when cw.c + 28 > v_today or sz.n = 0 then null else round((select count(*) from f join l on l.k = f.k and l.wk = cw.c + 28 where f.first_wk = cw.c)::numeric / sz.n, 4) end w4
      from (select count(*) n from f where f.first_wk = cw.c) sz
    ) r
  ), '[]'::jsonb);

  v_topics := coalesce((
    select jsonb_agg(jsonb_build_object(
      'topicId', topic_id, 'name', name, 'answers', answers,
      'firstTryAccuracy', case when answers > 0 then round(fc::numeric / answers, 4) end,
      'avgAnswerSeconds', case when answers > 0 then round(ms::numeric / answers / 1000, 1) end
    ) order by answers desc)
    from (
      select t.id::text topic_id, t.name, sum(d.attempts) answers, sum(d.first_correct) fc, sum(d.total_time_ms) ms
        from analytics_question_daily d
        join questions q on q.id::text = d.question_id
        join topics t on t.id = q.topic_id
       where v_from_day is null or d.day >= v_from_day
       group by t.id, t.name
      having sum(d.attempts) > 0
       order by sum(d.attempts) desc limit 15
    ) tp
  ), '[]'::jsonb);

  v_papers := coalesce((
    select jsonb_agg(jsonb_build_object('paperId', paper_id, 'title', title, 'sessions', n, 'completed', c) order by n desc)
    from (
      select s.source_ref paper_id, coalesce(nullif(concat_ws(' ', p.paper_code, p.series, p.year::text), ''), s.source_ref) title, count(*) n,
             count(*) filter (where s.completed_at is not null and not s.ended_early) c
        from _aa_s s
        left join papers p on p.id::text = s.source_ref
       where s.mode = 'paper' and s.source_ref is not null
       group by s.source_ref, p.paper_code, p.series, p.year
       order by count(*) desc limit 10
    ) pp
  ), '[]'::jsonb);

  create temp table if not exists _aa_q (like analytics_question_daily) on commit drop;
  truncate _aa_q;
  insert into _aa_q (question_id, day, attempts, first_correct, retry_correct, wrong, timeouts, total_time_ms, pick_a, pick_b, pick_c, pick_d)
    select question_id, min(day), sum(attempts), sum(first_correct), sum(retry_correct), sum(wrong), sum(timeouts),
           sum(total_time_ms), sum(pick_a), sum(pick_b), sum(pick_c), sum(pick_d)
      from analytics_question_daily
     where v_from_day is null or day >= v_from_day
     group by question_id having sum(attempts) >= 5;

  create temp table if not exists _aa_qs on commit drop as
    select null::text question_id, null::text label, null::text topic, 0 attempts, null::numeric acc, null::numeric avg_sec,
           null::text correct_label, null::text top_wrong, null::numeric top_wrong_share, false key_issue, 0 ord where false;
  truncate _aa_qs;
  insert into _aa_qs
    select z.*, 0 from (
      select a.question_id,
             coalesce(nullif(concat_ws(' ', p.paper_code, p.series, p.year::text), '') || ' · Q' || q.question_number::text, a.question_id) label,
             tp.name topic, a.attempts,
             round(a.first_correct::numeric / a.attempts, 4) acc,
             round(a.total_time_ms::numeric / a.attempts / 1000, 1) avg_sec,
             co.label correct_label,
             w.lbl top_wrong,
             case when (a.pick_a + a.pick_b + a.pick_c + a.pick_d) > 0 and w.lbl is not null
                  then round(w.n::numeric / (a.pick_a + a.pick_b + a.pick_c + a.pick_d), 4) end top_wrong_share,
             coalesce(w.n > cp.n, false) key_issue
        from _aa_q a
        left join questions q on q.id::text = a.question_id
        left join papers p on p.id = q.paper_id
        left join topics tp on tp.id = q.topic_id
        left join lateral (select upper(rtrim(o.label::text)) label from question_options o where o.question_id = q.id and o.is_correct limit 1) co on true
        left join lateral (
          select v.lbl, v.n from (values ('A', a.pick_a), ('B', a.pick_b), ('C', a.pick_c), ('D', a.pick_d)) v(lbl, n)
           where v.lbl is distinct from co.label and v.n > 0 order by v.n desc, v.lbl limit 1
        ) w on true
        left join lateral (
          select v.n from (values ('A', a.pick_a), ('B', a.pick_b), ('C', a.pick_c), ('D', a.pick_d)) v(lbl, n)
           where v.lbl = co.label
        ) cp on true
    ) z;

  v_hard := coalesce((select jsonb_agg(j order by acc, attempts desc) from (
      select acc, attempts, jsonb_build_object('questionId', question_id, 'label', label, 'topic', topic,
        'attempts', attempts, 'firstTryAccuracy', acc, 'avgAnswerSeconds', avg_sec, 'correctLabel', correct_label,
        'topWrongLabel', top_wrong, 'topWrongShare', top_wrong_share, 'possibleKeyIssue', key_issue) j
        from _aa_qs order by acc asc, attempts desc limit 10) h), '[]'::jsonb);
  v_slow := coalesce((select jsonb_agg(j order by avg_sec desc, attempts desc) from (
      select avg_sec, attempts, jsonb_build_object('questionId', question_id, 'label', label, 'topic', topic,
        'attempts', attempts, 'firstTryAccuracy', acc, 'avgAnswerSeconds', avg_sec, 'correctLabel', correct_label,
        'topWrongLabel', top_wrong, 'topWrongShare', top_wrong_share, 'possibleKeyIssue', key_issue) j
        from _aa_qs order by avg_sec desc, attempts desc limit 10) h), '[]'::jsonb);

  return jsonb_build_object(
    'trackingSince', v_since,
    'users', v_users, 'quizzes', v_quizzes, 'answers', v_answers,
    'daily', v_daily, 'heatmap', v_heat, 'retention', v_ret,
    'topics', v_topics, 'papers', v_papers,
    'hardestQuestions', v_hard, 'slowestQuestions', v_slow
  );
end;
$$;

revoke execute on function public.analytics_record_answer(uuid, uuid, uuid, text, int, text, text, boolean, int) from public, anon, authenticated;
revoke execute on function public.admin_analytics_summary(timestamptz) from public, anon, authenticated;
grant execute on function public.analytics_record_answer(uuid, uuid, uuid, text, int, text, text, boolean, int) to service_role;
grant execute on function public.admin_analytics_summary(timestamptz) to service_role;

commit;
