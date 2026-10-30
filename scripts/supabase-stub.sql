-- Just enough of a Supabase database to run the migrations and the pgTAP tests on a plain
-- PostgreSQL (scripts/test-db-local.sh): the API roles, auth.users and auth.uid(), and the storage
-- tables the stage photos use. Not a copy of Supabase: CI runs the tests on the real thing.
-- roles belong to the whole server, so a second run finds them there
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create schema storage;
create schema extensions;
grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text, created_at timestamptz not null default now());
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
  name text, owner uuid, created_at timestamptz default now(), unique (bucket_id, name));
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
create function storage.foldername(name text) returns text[] language plpgsql as $$
declare _parts text[]; begin select string_to_array(name, '/') into _parts; return _parts[1:array_length(_parts, 1) - 1]; end $$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
-- as Supabase: deleting from the storage tables in SQL is refused unless storage.allow_delete_query is on
-- (files are removed through the Storage API)
create function storage.protect_delete() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('storage.allow_delete_query', true), 'false') <> 'true' then
    raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.' using errcode = '42501';
  end if;
  return old;
end $$;
create trigger protect_objects_delete before delete on storage.objects for each row execute function storage.protect_delete();
create trigger protect_buckets_delete before delete on storage.buckets for each row execute function storage.protect_delete();
-- pg_cron's job list and the call that adds a job (named jobs are replaced, as pg_cron does)
create schema cron;
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text not null, command text not null);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $$;
-- Supabase grants the API roles everything on new tables in public by default
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
