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

-- Enable Realtime for the calls table so clients receive postgres_changes events
alter publication supabase_realtime add table public.calls;

-- Disable RLS for sandbox dev (consistent with other tables)
alter table if exists public.calls disable row level security;

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
