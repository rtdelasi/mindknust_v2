-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Create Profiles Table (Can store students, counselors, and admins)
create table if not exists public.profiles (
  id text primary key, -- Matches Auth UID (from Firebase or Supabase auth)
  name text not null,
  email text not null unique,
  role text not null check (role in ('student', 'counselor', 'admin')),
  avatar_url text,
  anonymous_id text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Student Profiles Table
create table if not exists public.student_profiles (
  user_id text primary key references public.profiles(id) on delete cascade,
  student_index_number text,
  program text,
  year_of_study integer,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Counselor Profiles Table (With credentials and approval status)
create table if not exists public.counselor_profiles (
  user_id text primary key references public.profiles(id) on delete cascade,
  license_number text not null,
  qualification text not null,
  credential_document_url text,
  specializations text[] default '{}'::text[],
  bio text,
  photo_url text,
  availability jsonb default '[]'::jsonb,
  approval_status text check (approval_status in ('pending', 'approved', 'rejected')) default 'pending' not null,
  rejection_reason text,
  reviewed_by text references public.profiles(id),
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Create Counselors Metadata Table
create table if not exists public.counselors (
  id text primary key references public.profiles(id) on delete cascade,
  specialties text[] not null default '{}',
  rating numeric(3,2) default 5.00,
  note text,
  bio text
);

-- 3. Create Availability Slots Table
create table if not exists public.availability_slots (
  id uuid default gen_random_uuid() primary key,
  counselor_id text references public.profiles(id) on delete cascade not null,
  day_of_week text not null, -- 'Monday', 'Tuesday', etc.
  time_slot text not null,   -- '10:00 AM', '2:30 PM'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Create Appointments / Sessions Table
create table if not exists public.appointments (
  id uuid default gen_random_uuid() primary key,
  student_id text references public.profiles(id) on delete cascade not null,
  counselor_id text references public.profiles(id) on delete cascade not null,
  appointment_date date not null,
  time_slot text not null,
  status text not null check (status in ('pending', 'accepted', 'declined', 'completed')) default 'pending',
  topic text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Create Chats / Conversations Table
create table if not exists public.chats (
  id uuid default gen_random_uuid() primary key,
  student_id text references public.profiles(id) on delete cascade not null,
  counselor_id text references public.profiles(id) on delete cascade not null,
  last_message text,
  last_message_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(student_id, counselor_id)
);

-- 6. Create Messages Table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  chat_id uuid references public.chats(id) on delete cascade not null,
  sender_id text references public.profiles(id) on delete cascade not null,
  text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  delivered_at timestamp with time zone,
  read_at timestamp with time zone
);

-- 7. Create Mood Logs Table
create table if not exists public.mood_logs (
  id uuid default gen_random_uuid() primary key,
  student_id text references public.profiles(id) on delete cascade not null,
  mood text not null, -- E.g. '😢', '😕', etc.
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Create Posts Table
create table if not exists public.posts (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  content text not null,
  media_url text,
  likes_count integer default 0 not null,
  comments_count integer default 0 not null,
  shares_count integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Create Likes Table
create table if not exists public.likes (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id text references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_post_user_like unique (post_id, user_id)
);

-- 10. Create Comments Table
create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id text references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Disable Row Level Security (RLS) on all tables for sandbox development
alter table if exists public.profiles disable row level security;
alter table if exists public.student_profiles disable row level security;
alter table if exists public.counselor_profiles disable row level security;
alter table if exists public.counselors disable row level security;
alter table if exists public.availability_slots disable row level security;
alter table if exists public.appointments disable row level security;
alter table if exists public.chats disable row level security;
alter table if exists public.messages disable row level security;
alter table if exists public.mood_logs disable row level security;
alter table if exists public.posts disable row level security;
alter table if exists public.likes disable row level security;
alter table if exists public.comments disable row level security;

-- Safety migration: ensure media_url column exists on public.posts
alter table if exists public.posts add column if not exists media_url text;

-- 11. Create Notifications Table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  body text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id text references public.profiles(id) on delete cascade,
  is_read boolean default false not null
);

-- Alterations for Sentiment and Moderation Engine
alter table if exists public.mood_logs add column if not exists sentiment_score numeric(3,2) default 0.00;
alter table if exists public.mood_logs add column if not exists sentiment_label text default 'neutral';
alter table if exists public.mood_logs add column if not exists is_flagged boolean default false;

alter table if exists public.posts add column if not exists moderation_status text default 'approved';
alter table if exists public.posts add column if not exists is_flagged boolean default false;
alter table if exists public.posts add column if not exists flag_reason text;
alter table if exists public.notifications disable row level security;

-- 12. Create Calls Table (video/voice call invites and state)
create table if not exists public.calls (
  id uuid default gen_random_uuid() primary key,
  caller_id text not null references public.profiles(id),
  callee_id text not null references public.profiles(id),
  call_type text not null check (call_type in ('voice', 'video')),
  status text not null check (status in ('ringing', 'accepted', 'declined', 'missed', 'ended')) default 'ringing',
  room_id text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  answered_at timestamp with time zone,
  ended_at timestamp with time zone
);

-- Realtime for the calls table is enabled in the consolidated Realtime section
-- at the bottom of this file (see "15. Realtime Publication").

-- Disable RLS for sandbox dev (consistent with other tables)
alter table if exists public.calls disable row level security;

-- 12b. Create News & Wellness Articles Table
create table if not exists public.news_articles (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  summary text not null,
  content text not null,
  image_url text,
  category text not null default 'Campus News',
  source text not null default 'KNUST Wellness',
  source_url text,
  is_pinned boolean default false not null,
  read_time text default '3 min read',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table if exists public.news_articles disable row level security;
grant all on public.news_articles to anon, authenticated, postgres, service_role;

-- 13. Anonymity System Migration
-- Permanent anonymous ID per student (generated once at signup)
alter table if exists public.profiles add column if not exists anonymous_id text unique;
alter table if exists public.profiles add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- Anonymous posting flags
alter table if exists public.posts add column if not exists is_anonymous boolean default false not null;
alter table if exists public.comments add column if not exists is_anonymous boolean default false not null;

-- Anonymous session display (UI-only; counselors always see real identity)
alter table if exists public.appointments add column if not exists is_anonymous_display boolean default false not null;

-- 14. Row-Level Security for Anonymity
-- Enable RLS on posts, comments
alter table if exists public.posts enable row level security;
alter table if exists public.comments enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Students can view own profile name for own posts" on public.posts;
drop policy if exists "Students can view own profile name for own comments" on public.comments;

-- Posts policy: students only see name when post is NOT anonymous OR they are the author
-- Counselors/admins always see full identity
create policy "Student post read with anonymity"
  on public.posts
  for select
  using (
    auth.role() = 'authenticated'
    and (
      (select role from public.profiles where id = auth.uid()) in ('counselor', 'admin')
      or user_id = auth.uid()
      or is_anonymous = false
    )
  );

-- Comments policy: same logic as posts
create policy "Student comment read with anonymity"
  on public.comments
  for select
  using (
    auth.role() = 'authenticated'
    and (select role from public.profiles where id = auth.uid()) in ('counselor', 'admin')
  );

create policy "Student read own comment name"
  on public.comments
  for select
  using (
    user_id = auth.uid()
    or is_anonymous = false
  );

-- Appointments: students can only see own, counselors can see all their students
alter table if exists public.appointments enable row level security;

drop policy if exists "Student view own appointment" on public.appointments;
drop policy if exists "Counselor view assigned appointment" on public.appointments;

create policy "Student view own appointment"
  on public.appointments
  for select
  using (student_id = auth.uid());

create policy "Counselor view assigned appointment"
  on public.appointments
  for select
  using (counselor_id = auth.uid());

-- Messages: students only see their own chats
alter table if exists public.messages enable row level security;

drop policy if exists "View own chat messages" on public.messages;

create policy "View own chat messages"
  on public.messages
  for select
  using (
    sender_id = auth.uid()
    or chat_id in (
      select id from public.chats where student_id = auth.uid() or counselor_id = auth.uid()
    )
  );

-- ############################################################################
-- ##  SECURITY WARNING — READ BEFORE DEPLOYING                              ##
-- ############################################################################
-- The block below disables RLS on every table and grants full CRUD to the
-- `anon` role. Because EXPO_PUBLIC_SUPABASE_ANON_KEY ships inside the app
-- bundle, ANY user who extracts it has unrestricted read/write access to every
-- profile, chat message, mood log and appointment in this database.
--
-- This is acceptable for local sandbox development ONLY. It must not reach
-- production for an app handling mental-health data.
--
-- Note also that the policies defined above (lines ~200-270) are currently
-- dead code twice over:
--   1. They are revoked by the `disable row level security` block below.
--   2. They test `auth.uid()`, which is always NULL here — the app
--      authenticates with Firebase and never establishes a Supabase session,
--      so every request arrives as the anonymous role. Simply re-enabling RLS
--      would therefore deny all traffic and break the entire app.
--
-- To secure this properly, one of the following is required:
--   a) Migrate authentication to Supabase Auth, so auth.uid() is populated; or
--   b) Mint a Supabase JWT signed with the project secret after Firebase login
--      and call supabase.auth.setSession(), then rewrite policies against the
--      Firebase UID claim; or
--   c) Move all data access behind server-side Edge Functions holding the
--      service-role key, and revoke anon privileges entirely.
-- ############################################################################

-- Master Disable RLS block for dev/testing
alter table if exists public.profiles disable row level security;
alter table if exists public.student_profiles disable row level security;
alter table if exists public.counselor_profiles disable row level security;
alter table if exists public.counselors disable row level security;
alter table if exists public.availability_slots disable row level security;
alter table if exists public.appointments disable row level security;
alter table if exists public.chats disable row level security;
alter table if exists public.messages disable row level security;
alter table if exists public.mood_logs disable row level security;
alter table if exists public.posts disable row level security;
alter table if exists public.likes disable row level security;
alter table if exists public.comments disable row level security;
alter table if exists public.notifications disable row level security;
alter table if exists public.calls disable row level security;

grant all on public.profiles to anon, authenticated, postgres, service_role;
grant all on public.student_profiles to anon, authenticated, postgres, service_role;
grant all on public.counselor_profiles to anon, authenticated, postgres, service_role;
grant all on public.counselors to anon, authenticated, postgres, service_role;
grant all on public.availability_slots to anon, authenticated, postgres, service_role;
grant all on public.appointments to anon, authenticated, postgres, service_role;
grant all on public.chats to anon, authenticated, postgres, service_role;
grant all on public.messages to anon, authenticated, postgres, service_role;
grant all on public.mood_logs to anon, authenticated, postgres, service_role;
grant all on public.posts to anon, authenticated, postgres, service_role;
grant all on public.likes to anon, authenticated, postgres, service_role;
grant all on public.comments to anon, authenticated, postgres, service_role;
grant all on public.notifications to anon, authenticated, postgres, service_role;
grant all on public.calls to anon, authenticated, postgres, service_role;

-- ############################################################################
-- 15. Realtime Publication
--
-- Postgres only streams WAL changes for tables that belong to the
-- `supabase_realtime` publication. A `.on('postgres_changes', ...)`
-- subscription against a table that is NOT a member silently receives
-- nothing -- the channel still reports SUBSCRIBED, so the failure is invisible
-- from the client. Every table the app subscribes to must be listed here.
--
-- Client subscription sites (keep this list in sync):
--   messages           -> src/app/chat/[id].tsx        (INSERT + UPDATE)
--   notifications      -> src/app/_layout.tsx, (tabs)/index.tsx,
--                         (counselor-tabs)/index.tsx
--   counselor_profiles -> src/app/(tabs)/_layout.tsx, (tabs)/approvals.tsx,
--                         src/app/counselor-pending.tsx
--   calls              -> src/lib/supabase-db.ts
-- ############################################################################

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'messages',
      'notifications',
      'counselor_profiles',
      'calls'
    ])
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice 'Added public.% to supabase_realtime', t;
    else
      raise notice 'public.% already in supabase_realtime, skipping', t;
    end if;
  end loop;
end
$$;

-- ############################################################################
-- 16. Counselor Reviews
--
-- `counselors.rating` is a denormalized aggregate, kept in sync by the trigger
-- below. Never write it directly -- insert into counselor_reviews instead.
--
-- One review per completed appointment: the unique constraint on
-- appointment_id is what enforces "a student may rate a session exactly once".
-- ############################################################################

create table if not exists public.counselor_reviews (
  id uuid default gen_random_uuid() primary key,
  appointment_id uuid references public.appointments(id) on delete cascade not null unique,
  counselor_id text references public.profiles(id) on delete cascade not null,
  student_id text references public.profiles(id) on delete cascade not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  is_anonymous boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists counselor_reviews_counselor_idx
  on public.counselor_reviews (counselor_id, created_at desc);

create index if not exists counselor_reviews_student_idx
  on public.counselor_reviews (student_id);

-- Review count alongside the existing `rating` column, so the UI can tell
-- "no reviews yet" apart from a genuine average. Without it every counselor
-- reads as a perfect 5.00 -- the column default -- before anyone has rated.
alter table if exists public.counselors
  add column if not exists review_count integer default 0 not null;

-- Optional in-app route for a notification, so an announcement can deep-link
-- (e.g. "Session Completed" -> the rating screen). Null for plain messages.
alter table if exists public.notifications
  add column if not exists link text;

-- Recompute the denormalized aggregate whenever reviews change.
-- Upserts rather than updates: fetchCounselors() in src/lib/supabase-db.ts
-- synthesizes list entries for counselors that have a profiles row but no
-- counselors row, so the target row is not guaranteed to exist.
create or replace function public.recalc_counselor_rating()
returns trigger
language plpgsql
as $$
declare
  target_id text;
  avg_rating numeric(3,2);
  total integer;
begin
  target_id := coalesce(new.counselor_id, old.counselor_id);

  select round(avg(rating)::numeric, 2), count(*)
    into avg_rating, total
    from public.counselor_reviews
   where counselor_id = target_id;

  -- 0.00 rather than the 5.00 column default when no reviews remain: paired
  -- with review_count = 0 it means "unrated", which the UI renders as "New".
  -- Falling back to 5.00 here would make a counselor whose only review was
  -- deleted read as perfectly rated again.
  insert into public.counselors (id, rating, review_count)
  values (target_id, coalesce(avg_rating, 0.00), coalesce(total, 0))
  on conflict (id) do update
    set rating = excluded.rating,
        review_count = excluded.review_count;

  return null;
end;
$$;

drop trigger if exists counselor_reviews_recalc on public.counselor_reviews;

create trigger counselor_reviews_recalc
after insert or update or delete on public.counselor_reviews
for each row execute function public.recalc_counselor_rating();

-- The 5.00 column default predates reviews and would make every newly created
-- counselor read as perfectly rated. Unrated is 0.00 + review_count 0.
alter table if exists public.counselors
  alter column rating set default 0.00;

-- Backfill existing rows so the aggregate is correct on first deploy.
-- Left join, not inner: counselors with no reviews must be reset to 0.00 too,
-- otherwise they keep the old 5.00 default and read as five-star forever.
update public.counselors c
   set rating = coalesce(agg.avg_rating, 0.00),
       review_count = coalesce(agg.total, 0)
  from (
    select p.id as counselor_id, x.avg_rating, x.total
      from public.profiles p
      left join (
        select counselor_id,
               round(avg(rating)::numeric, 2) as avg_rating,
               count(*) as total
          from public.counselor_reviews
         group by counselor_id
      ) x on x.counselor_id = p.id
  ) agg
 where c.id = agg.counselor_id;

alter table if exists public.counselor_reviews disable row level security;
grant all on public.counselor_reviews to anon, authenticated, postgres, service_role;

-- Seed Default Demo/Fallback Profiles if they do not exist
insert into public.profiles (id, name, email, role)
values 
  ('student-user', 'Student User', 'student@mindknust.edu.gh', 'student'),
  ('kwame-boateng', 'Dr. Kwame Boateng', 'kwame.boateng@mindknust.edu.gh', 'counselor')
on conflict (id) do nothing;

insert into public.student_profiles (user_id, program, year_of_study)
values ('student-user', 'Computer Science', 3)
on conflict (user_id) do nothing;

insert into public.counselor_profiles (user_id, license_number, qualification, specializations, approval_status)
values ('kwame-boateng', 'KNUST-CP-001', 'Ph.D Clinical Psychology', array['Clinical Psychology', 'Anxiety & Stress Management'], 'approved')
on conflict (user_id) do nothing;

-- Storage Bucket Setup for Social Media & Avatars
insert into storage.buckets (id, name, public)
values ('social-media', 'social-media', true)
on conflict (id) do update set public = true;

-- Storage Policies for Public Uploads & Reads
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Allow Public Uploads to social-media'
  ) then
    create policy "Allow Public Uploads to social-media"
    on storage.objects for insert
    with check (bucket_id = 'social-media');
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'Allow Public Reads on social-media'
  ) then
    create policy "Allow Public Reads on social-media"
    on storage.objects for select
    using (bucket_id = 'social-media');
  end if;
end
$$;



