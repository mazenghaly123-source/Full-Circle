-- Supabase pauses a free-plan project that sees too few database queries in a week. The site's Worker
-- calls this twice a day (src/worker.ts, `scheduled`) so the project is never paused while it is on the
-- free plan. It reads nothing and answers true.
create function public.alive() returns boolean
language sql stable set search_path = ''
as $$ select true $$;
comment on function public.alive() is 'Answers true. Called twice a day by the site''s Worker so the free-plan project is not paused for inactivity.';
revoke all on function public.alive() from public;
grant execute on function public.alive() to anon;
