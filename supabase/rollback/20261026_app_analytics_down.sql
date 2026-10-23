-- Rollback for 20261026_app_analytics.sql. APPLY ONLY WITH JOEL'S APPROVAL.
begin;

drop function if exists public.admin_analytics_summary(timestamptz);
drop function if exists public.analytics_record_answer(uuid, uuid, uuid, text, int, text, text, boolean, int);
drop table if exists public.analytics_question_daily;
drop table if exists public.analytics_session_questions;
drop table if exists public.analytics_quiz_sessions;

commit;
