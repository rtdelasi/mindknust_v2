-- ============================================================================
-- MindKNUST Production Database Schema & Strict Row-Level Security (RLS)
-- ============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Base Relational Tables
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Profiles Table
create table if not exists public.profiles (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null check (role in ('student', 'counselor', 'admin')),
  avatar_url text,
  anonymous_id text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Student Profiles Table
create table if not exists public.student_profiles (
  user_id text primary key references public.profiles(id) on delete cascade,
  student_index_number text,
  program text,
  year_of_study integer,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Counselor Profiles Table
create table if not exists public.counselor_profiles (
  user_id text primary key references public.profiles(id) on delete cascade,
  license_number text not null default 'Pending',
  qualification text not null default 'Pending',
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

-- 4. Counselors Rating Stats Metadata Table
create table if not exists public.counselors (
  id text primary key references public.profiles(id) on delete cascade,
  specialties text[] not null default '{}',
  rating numeric(3,2) default 0.00,
  review_count integer default 0 not null,
  note text,
  bio text
);

-- 5. Availability Slots Table
create table if not exists public.availability_slots (
  id uuid default gen_random_uuid() primary key,
  counselor_id text references public.profiles(id) on delete cascade not null,
  day_of_week text not null,
  time_slot text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Appointments Table
create table if not exists public.appointments (
  id uuid default gen_random_uuid() primary key,
  student_id text references public.profiles(id) on delete cascade not null,
  counselor_id text references public.profiles(id) on delete cascade not null,
  appointment_date date not null,
  time_slot text not null,
  status text not null check (status in ('pending', 'accepted', 'declined', 'completed', 'missed')) default 'pending',
  topic text,
  is_anonymous_display boolean default false not null,
  student_joined_at timestamp with time zone,
  counselor_joined_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Chats Table
create table if not exists public.chats (
  id uuid default gen_random_uuid() primary key,
  student_id text references public.profiles(id) on delete cascade not null,
  counselor_id text references public.profiles(id) on delete cascade not null,
  last_message text,
  last_message_time timestamp with time zone default timezone('utc'::text, now()) not null,
  unread_count integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint chats_student_counselor_unique unique (student_id, counselor_id)
);

-- 8. Messages Table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  chat_id uuid references public.chats(id) on delete cascade not null,
  sender_id text references public.profiles(id) on delete cascade not null,
  text text not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  is_read boolean default false not null,
  media_url text,
  media_type text check (media_type in ('image', 'audio', 'document', 'video')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Mood Logs Table
create table if not exists public.mood_logs (
  id uuid default gen_random_uuid() primary key,
  student_id text references public.profiles(id) on delete cascade not null,
  mood text not null,
  intensity integer check (intensity between 1 and 10),
  factors text[] default '{}'::text[],
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. Posts Table
create table if not exists public.posts (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  author_name text not null default 'Anonymous',
  author_avatar text,
  category text not null default 'General',
  content text not null,
  is_anonymous boolean default false not null,
  likes_count integer default 0 not null,
  comments_count integer default 0 not null,
  moderation_status text check (moderation_status in ('approved', 'flagged', 'blocked')) default 'approved' not null,
  flagged_reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 11. Likes Table
create table if not exists public.likes (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id text references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint likes_post_user_unique unique (post_id, user_id)
);

-- 12. Comments Table
create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id text references public.profiles(id) on delete cascade not null,
  author_name text not null default 'Anonymous',
  author_avatar text,
  content text not null,
  is_anonymous boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 13. Notifications Table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  title text not null,
  body text not null,
  type text not null,
  is_read boolean default false not null,
  data jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 14. Calls Table
create table if not exists public.calls (
  id uuid default gen_random_uuid() primary key,
  appointment_id uuid references public.appointments(id) on delete cascade,
  caller_id text references public.profiles(id) on delete cascade not null,
  receiver_id text references public.profiles(id) on delete cascade not null,
  status text check (status in ('ringing', 'active', 'ended', 'rejected', 'missed')) default 'ringing' not null,
  channel_id text,
  call_type text check (call_type in ('audio', 'video')) default 'video' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone
);

-- 15. News & Announcements Table
create table if not exists public.news_articles (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  summary text not null default '',
  content text not null,
  image_url text,
  category text not null default 'Campus News' check (category in ('Campus News', 'Mental Health', 'Self-Care', 'Academic Stress')),
  source text not null default 'KNUST Wellness',
  is_pinned boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 16. Counselor Reviews Table
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Comprehensive Safe Column Migrations for Existing Tables
-- ═══════════════════════════════════════════════════════════════════════════

-- Profiles
alter table if exists public.profiles add column if not exists name text;
alter table if exists public.profiles add column if not exists email text;
alter table if exists public.profiles add column if not exists role text;
alter table if exists public.profiles add column if not exists avatar_url text;
alter table if exists public.profiles add column if not exists anonymous_id text;
alter table if exists public.profiles add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- Student Profiles
alter table if exists public.student_profiles add column if not exists student_index_number text;
alter table if exists public.student_profiles add column if not exists program text;
alter table if exists public.student_profiles add column if not exists year_of_study integer;
alter table if exists public.student_profiles add column if not exists emergency_contact_name text;
alter table if exists public.student_profiles add column if not exists emergency_contact_phone text;
alter table if exists public.student_profiles add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- Counselor Profiles
alter table if exists public.counselor_profiles add column if not exists license_number text default 'Pending';
alter table if exists public.counselor_profiles add column if not exists qualification text default 'Pending';
alter table if exists public.counselor_profiles add column if not exists credential_document_url text;
alter table if exists public.counselor_profiles add column if not exists specializations text[] default '{}'::text[];
alter table if exists public.counselor_profiles add column if not exists bio text;
alter table if exists public.counselor_profiles add column if not exists photo_url text;
alter table if exists public.counselor_profiles add column if not exists availability jsonb default '[]'::jsonb;
alter table if exists public.counselor_profiles add column if not exists approval_status text default 'pending';
alter table if exists public.counselor_profiles add column if not exists rejection_reason text;
alter table if exists public.counselor_profiles add column if not exists reviewed_by text;
alter table if exists public.counselor_profiles add column if not exists reviewed_at timestamp with time zone;
alter table if exists public.counselor_profiles add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- Counselors
alter table if exists public.counselors add column if not exists specialties text[] default '{}';
alter table if exists public.counselors add column if not exists rating numeric(3,2) default 0.00;
alter table if exists public.counselors add column if not exists review_count integer default 0;
alter table if exists public.counselors add column if not exists note text;
alter table if exists public.counselors add column if not exists bio text;

-- Availability Slots
alter table if exists public.availability_slots add column if not exists counselor_id text;
alter table if exists public.availability_slots add column if not exists day_of_week text;
alter table if exists public.availability_slots add column if not exists time_slot text;
alter table if exists public.availability_slots add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- Appointments
alter table if exists public.appointments add column if not exists student_id text;
alter table if exists public.appointments add column if not exists counselor_id text;
alter table if exists public.appointments add column if not exists appointment_date date;
alter table if exists public.appointments add column if not exists time_slot text;
alter table if exists public.appointments add column if not exists status text default 'pending';
alter table if exists public.appointments add column if not exists topic text;
alter table if exists public.appointments add column if not exists is_anonymous_display boolean default false;
alter table if exists public.appointments add column if not exists student_joined_at timestamp with time zone;
alter table if exists public.appointments add column if not exists counselor_joined_at timestamp with time zone;
alter table if exists public.appointments add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- Chats
alter table if exists public.chats add column if not exists student_id text;
alter table if exists public.chats add column if not exists counselor_id text;
alter table if exists public.chats add column if not exists last_message text;
alter table if exists public.chats add column if not exists last_message_time timestamp with time zone default timezone('utc'::text, now());
alter table if exists public.chats add column if not exists unread_count integer default 0;
alter table if exists public.chats add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- Messages
alter table if exists public.messages add column if not exists chat_id uuid;
alter table if exists public.messages add column if not exists sender_id text;
alter table if exists public.messages add column if not exists text text;
alter table if exists public.messages add column if not exists timestamp timestamp with time zone default timezone('utc'::text, now());
alter table if exists public.messages add column if not exists is_read boolean default false;
alter table if exists public.messages add column if not exists media_url text;
alter table if exists public.messages add column if not exists media_type text;
alter table if exists public.messages add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- Mood Logs
alter table if exists public.mood_logs add column if not exists student_id text;
alter table if exists public.mood_logs add column if not exists mood text;
alter table if exists public.mood_logs add column if not exists intensity integer;
alter table if exists public.mood_logs add column if not exists factors text[] default '{}'::text[];
alter table if exists public.mood_logs add column if not exists note text;
alter table if exists public.mood_logs add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- Posts
alter table if exists public.posts add column if not exists user_id text;
alter table if exists public.posts add column if not exists author_name text default 'Anonymous';
alter table if exists public.posts add column if not exists author_avatar text;
alter table if exists public.posts add column if not exists category text not null default 'General';
alter table if exists public.posts add column if not exists content text;
alter table if exists public.posts add column if not exists is_anonymous boolean default false;
alter table if exists public.posts add column if not exists likes_count integer default 0;
alter table if exists public.posts add column if not exists comments_count integer default 0;
alter table if exists public.posts add column if not exists moderation_status text default 'approved';
alter table if exists public.posts add column if not exists flagged_reason text;
alter table if exists public.posts add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- Likes
alter table if exists public.likes add column if not exists post_id uuid;
alter table if exists public.likes add column if not exists user_id text;
alter table if exists public.likes add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- Comments
alter table if exists public.comments add column if not exists post_id uuid;
alter table if exists public.comments add column if not exists user_id text;
alter table if exists public.comments add column if not exists author_name text default 'Anonymous';
alter table if exists public.comments add column if not exists author_avatar text;
alter table if exists public.comments add column if not exists content text;
alter table if exists public.comments add column if not exists is_anonymous boolean default false;
alter table if exists public.comments add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- Notifications
alter table if exists public.notifications add column if not exists user_id text;
alter table if exists public.notifications add column if not exists title text;
alter table if exists public.notifications add column if not exists body text;
alter table if exists public.notifications add column if not exists type text;
alter table if exists public.notifications add column if not exists is_read boolean default false;
alter table if exists public.notifications add column if not exists data jsonb default '{}'::jsonb;
alter table if exists public.notifications add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- Calls
alter table if exists public.calls add column if not exists appointment_id uuid;
alter table if exists public.calls add column if not exists caller_id text;
alter table if exists public.calls add column if not exists receiver_id text;
alter table if exists public.calls add column if not exists status text default 'ringing';
alter table if exists public.calls add column if not exists channel_id text;
alter table if exists public.calls add column if not exists call_type text default 'video';
alter table if exists public.calls add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());
alter table if exists public.calls add column if not exists ended_at timestamp with time zone;

-- News Articles
alter table if exists public.news_articles add column if not exists title text;
alter table if exists public.news_articles add column if not exists summary text default '';
alter table if exists public.news_articles add column if not exists content text;
alter table if exists public.news_articles add column if not exists image_url text;
alter table if exists public.news_articles add column if not exists category text not null default 'Campus News';
alter table if exists public.news_articles add column if not exists source text default 'KNUST Wellness';
alter table if exists public.news_articles add column if not exists is_pinned boolean default false;
alter table if exists public.news_articles add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());
alter table if exists public.news_articles add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now());

-- Counselor Reviews
alter table if exists public.counselor_reviews add column if not exists appointment_id uuid;
alter table if exists public.counselor_reviews add column if not exists counselor_id text;
alter table if exists public.counselor_reviews add column if not exists student_id text;
alter table if exists public.counselor_reviews add column if not exists rating integer;
alter table if exists public.counselor_reviews add column if not exists comment text;
alter table if exists public.counselor_reviews add column if not exists is_anonymous boolean default false;
alter table if exists public.counselor_reviews add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Security Helper Functions
-- ═══════════════════════════════════════════════════════════════════════════

-- Helper: Extract current user UID from Supabase Auth, Firebase Token, or PostgREST JWT claims
create or replace function public.current_user_id()
returns text
language sql
security definer
stable
as $$
  select coalesce(
    auth.uid()::text,
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claim.user_id', true), '')
  );
$$;

-- Helper: Check if current session user is an admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = public.current_user_id() and role = 'admin'
  );
$$;

-- Helper: Check if current session user is a counselor
create or replace function public.is_counselor()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = public.current_user_id() and role = 'counselor'
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Dynamic Rating Recalculation Trigger
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.recalc_counselor_rating()
returns trigger
language plpgsql
security definer
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

  insert into public.counselors (id, rating, review_count)
  values (target_id, coalesce(avg_rating, 0.00), coalesce(total, 0))
  on conflict (id) do update
    set rating = excluded.rating,
        review_count = excluded.review_count;

  return null;
end;
$$;

drop trigger if exists on_counselor_review_inserted on public.counselor_reviews;
create trigger on_counselor_review_inserted
  after insert or update or delete
  on public.counselor_reviews
  for each row
  execute function public.recalc_counselor_rating();

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Dynamic Like and Comment Counters
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.handle_like_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.posts
    set likes_count = likes_count + 1
    where id = new.post_id;
    return new;
  elsif (TG_OP = 'DELETE') then
    update public.posts
    set likes_count = greatest(0, likes_count - 1)
    where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists on_like_change on public.likes;
create trigger on_like_change
  after insert or delete on public.likes
  for each row
  execute function public.handle_like_count();

create or replace function public.handle_comment_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.posts
    set comments_count = comments_count + 1
    where id = new.post_id;
    return new;
  elsif (TG_OP = 'DELETE') then
    update public.posts
    set comments_count = greatest(0, comments_count - 1)
    where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists on_comment_change on public.comments;
create trigger on_comment_change
  after insert or delete on public.comments
  for each row
  execute function public.handle_comment_count();

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Performance Indexes
-- ═══════════════════════════════════════════════════════════════════════════

create index if not exists appointments_student_idx on public.appointments(student_id);
create index if not exists appointments_counselor_idx on public.appointments(counselor_id);
create index if not exists appointments_status_idx on public.appointments(status);
create index if not exists availability_slots_counselor_idx on public.availability_slots(counselor_id);
create index if not exists chats_student_idx on public.chats(student_id);
create index if not exists chats_counselor_idx on public.chats(counselor_id);
create index if not exists messages_chat_idx on public.messages(chat_id, created_at desc);
create index if not exists mood_logs_student_idx on public.mood_logs(student_id, created_at desc);
create index if not exists posts_category_idx on public.posts(category, created_at desc);
create index if not exists posts_moderation_idx on public.posts(moderation_status, created_at desc);
create index if not exists comments_post_idx on public.comments(post_id, created_at asc);
create index if not exists likes_post_idx on public.likes(post_id);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists calls_appointment_idx on public.calls(appointment_id);
create index if not exists news_articles_pinned_idx on public.news_articles (is_pinned desc, created_at desc);
create index if not exists counselor_reviews_counselor_idx on public.counselor_reviews (counselor_id, created_at desc);
create index if not exists counselor_reviews_student_idx on public.counselor_reviews (student_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Enable Row Level Security (RLS) on ALL Tables
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.counselor_profiles enable row level security;
alter table public.counselors enable row level security;
alter table public.availability_slots enable row level security;
alter table public.appointments enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.mood_logs enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.calls enable row level security;
alter table public.news_articles enable row level security;
alter table public.counselor_reviews enable row level security;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Strict Multi-Tenant Row Level Security Policies
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Profiles Table Policies ──────────────────────────────────────────────
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (public.current_user_id() = id or public.is_admin());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (public.current_user_id() = id or public.is_admin())
  with check (public.current_user_id() = id or public.is_admin());

-- ── 2. Student Profiles Policies ────────────────────────────────────────────
drop policy if exists "Student profile viewable by self counselors admins" on public.student_profiles;
create policy "Student profile viewable by self counselors admins"
  on public.student_profiles for select
  using (public.current_user_id() = user_id or public.is_counselor() or public.is_admin());

drop policy if exists "Student can insert own profile" on public.student_profiles;
create policy "Student can insert own profile"
  on public.student_profiles for insert
  with check (public.current_user_id() = user_id or public.is_admin());

drop policy if exists "Student can update own profile" on public.student_profiles;
create policy "Student can update own profile"
  on public.student_profiles for update
  using (public.current_user_id() = user_id or public.is_admin())
  with check (public.current_user_id() = user_id or public.is_admin());

-- ── 3. Counselor Profiles Policies ──────────────────────────────────────────
drop policy if exists "Counselor profiles visible if approved or owner or admin" on public.counselor_profiles;
create policy "Counselor profiles visible if approved or owner or admin"
  on public.counselor_profiles for select
  using (approval_status = 'approved' or public.current_user_id() = user_id or public.is_admin());

drop policy if exists "Counselor can apply/insert own profile" on public.counselor_profiles;
create policy "Counselor can apply/insert own profile"
  on public.counselor_profiles for insert
  with check (public.current_user_id() = user_id or public.is_admin());

drop policy if exists "Counselor can update own profile, admin can review" on public.counselor_profiles;
create policy "Counselor can update own profile, admin can review"
  on public.counselor_profiles for update
  using (public.current_user_id() = user_id or public.is_admin())
  with check (public.current_user_id() = user_id or public.is_admin());

-- ── 4. Counselors Rating Stats Policies ─────────────────────────────────────
drop policy if exists "Counselors stats are publicly readable" on public.counselors;
create policy "Counselors stats are publicly readable"
  on public.counselors for select
  using (true);

drop policy if exists "Counselors can update own stats or admin" on public.counselors;
create policy "Counselors can update own stats or admin"
  on public.counselors for all
  using (public.current_user_id() = id or public.is_admin())
  with check (public.current_user_id() = id or public.is_admin());

-- ── 5. Availability Slots Policies ──────────────────────────────────────────
drop policy if exists "Availability slots are viewable by all" on public.availability_slots;
create policy "Availability slots are viewable by all"
  on public.availability_slots for select
  using (true);

drop policy if exists "Counselors can insert availability slots" on public.availability_slots;
create policy "Counselors can insert availability slots"
  on public.availability_slots for insert
  with check (public.current_user_id() = counselor_id or public.is_admin());

drop policy if exists "Counselors can update availability slots" on public.availability_slots;
create policy "Counselors can update availability slots"
  on public.availability_slots for update
  using (public.current_user_id() = counselor_id or public.is_admin())
  with check (public.current_user_id() = counselor_id or public.is_admin());

drop policy if exists "Counselors can delete availability slots" on public.availability_slots;
create policy "Counselors can delete availability slots"
  on public.availability_slots for delete
  using (public.current_user_id() = counselor_id or public.is_admin());

-- ── 6. Appointments Policies ────────────────────────────────────────────────
drop policy if exists "Appointments viewable by participants or admin" on public.appointments;
create policy "Appointments viewable by participants or admin"
  on public.appointments for select
  using (public.current_user_id() = student_id or public.current_user_id() = counselor_id or public.is_admin());

drop policy if exists "Students can book appointments" on public.appointments;
create policy "Students can book appointments"
  on public.appointments for insert
  with check (public.current_user_id() = student_id or public.is_admin());

drop policy if exists "Participants can update appointments" on public.appointments;
create policy "Participants can update appointments"
  on public.appointments for update
  using (public.current_user_id() = student_id or public.current_user_id() = counselor_id or public.is_admin())
  with check (public.current_user_id() = student_id or public.current_user_id() = counselor_id or public.is_admin());

-- ── 7. Counselor Reviews Policies ───────────────────────────────────────────
drop policy if exists "Counselor reviews are publicly readable" on public.counselor_reviews;
create policy "Counselor reviews are publicly readable"
  on public.counselor_reviews for select
  using (true);

drop policy if exists "Verified students can submit reviews" on public.counselor_reviews;
create policy "Verified students can submit reviews"
  on public.counselor_reviews for insert
  with check (
    public.current_user_id() = student_id
    and exists (
      select 1 from public.appointments
      where id = appointment_id and student_id = public.current_user_id()
    )
  );

drop policy if exists "Students can update own review" on public.counselor_reviews;
create policy "Students can update own review"
  on public.counselor_reviews for update
  using (public.current_user_id() = student_id or public.is_admin())
  with check (public.current_user_id() = student_id or public.is_admin());

drop policy if exists "Students or admin can delete review" on public.counselor_reviews;
create policy "Students or admin can delete review"
  on public.counselor_reviews for delete
  using (public.current_user_id() = student_id or public.is_admin());

-- ── 8. Chats Policies ───────────────────────────────────────────────────────
drop policy if exists "Chats viewable by participants or admin" on public.chats;
create policy "Chats viewable by participants or admin"
  on public.chats for select
  using (public.current_user_id() = student_id or public.current_user_id() = counselor_id or public.is_admin());

drop policy if exists "Participants can insert chats" on public.chats;
create policy "Participants can insert chats"
  on public.chats for insert
  with check (public.current_user_id() = student_id or public.current_user_id() = counselor_id or public.is_admin());

drop policy if exists "Participants can update chats" on public.chats;
create policy "Participants can update chats"
  on public.chats for update
  using (public.current_user_id() = student_id or public.current_user_id() = counselor_id or public.is_admin())
  with check (public.current_user_id() = student_id or public.current_user_id() = counselor_id or public.is_admin());

-- ── 9. Messages Policies ────────────────────────────────────────────────────
drop policy if exists "Messages viewable by chat participants" on public.messages;
create policy "Messages viewable by chat participants"
  on public.messages for select
  using (
    exists (
      select 1 from public.chats
      where id = chat_id and (student_id = public.current_user_id() or counselor_id = public.current_user_id())
    )
    or public.is_admin()
  );

drop policy if exists "Sender can insert message in authorized chat" on public.messages;
create policy "Sender can insert message in authorized chat"
  on public.messages for insert
  with check (
    public.current_user_id() = sender_id
    and exists (
      select 1 from public.chats
      where id = chat_id and (student_id = public.current_user_id() or counselor_id = public.current_user_id())
    )
  );

drop policy if exists "Participants can mark messages as read" on public.messages;
create policy "Participants can mark messages as read"
  on public.messages for update
  using (
    exists (
      select 1 from public.chats
      where id = chat_id and (student_id = public.current_user_id() or counselor_id = public.current_user_id())
    )
    or public.is_admin()
  );

drop policy if exists "Sender or admin can delete message" on public.messages;
create policy "Sender or admin can delete message"
  on public.messages for delete
  using (sender_id = public.current_user_id() or public.is_admin());

-- ── 10. Mood Logs Policies (Strict Confidentiality) ─────────────────────────
drop policy if exists "Mood logs viewable only by owner or admin" on public.mood_logs;
create policy "Mood logs viewable only by owner or admin"
  on public.mood_logs for select
  using (public.current_user_id() = student_id or public.is_admin());

drop policy if exists "Student can insert own mood logs" on public.mood_logs;
create policy "Student can insert own mood logs"
  on public.mood_logs for insert
  with check (public.current_user_id() = student_id or public.is_admin());

drop policy if exists "Student can update own mood logs" on public.mood_logs;
create policy "Student can update own mood logs"
  on public.mood_logs for update
  using (public.current_user_id() = student_id or public.is_admin())
  with check (public.current_user_id() = student_id or public.is_admin());

drop policy if exists "Student can delete own mood logs" on public.mood_logs;
create policy "Student can delete own mood logs"
  on public.mood_logs for delete
  using (public.current_user_id() = student_id or public.is_admin());

-- ── 11. Posts Policies ──────────────────────────────────────────────────────
drop policy if exists "Approved posts viewable by all, blocked by author/admin" on public.posts;
create policy "Approved posts viewable by all, blocked by author/admin"
  on public.posts for select
  using (moderation_status != 'blocked' or public.current_user_id() = user_id or public.is_admin());

drop policy if exists "Authenticated users can create posts" on public.posts;
create policy "Authenticated users can create posts"
  on public.posts for insert
  with check (public.current_user_id() = user_id or public.is_admin());

drop policy if exists "Authors can update own posts, admin can moderate" on public.posts;
create policy "Authors can update own posts, admin can moderate"
  on public.posts for update
  using (public.current_user_id() = user_id or public.is_admin())
  with check (public.current_user_id() = user_id or public.is_admin());

drop policy if exists "Authors or admin can delete posts" on public.posts;
create policy "Authors or admin can delete posts"
  on public.posts for delete
  using (public.current_user_id() = user_id or public.is_admin());

-- ── 12. Likes Policies ──────────────────────────────────────────────────────
drop policy if exists "Likes are viewable by all" on public.likes;
create policy "Likes are viewable by all"
  on public.likes for select
  using (true);

drop policy if exists "Authenticated users can like posts" on public.likes;
create policy "Authenticated users can like posts"
  on public.likes for insert
  with check (public.current_user_id() = user_id or public.is_admin());

drop policy if exists "Users can remove their own like" on public.likes;
create policy "Users can remove their own like"
  on public.likes for delete
  using (public.current_user_id() = user_id or public.is_admin());

-- ── 13. Comments Policies ───────────────────────────────────────────────────
drop policy if exists "Comments are viewable by all" on public.comments;
create policy "Comments are viewable by all"
  on public.comments for select
  using (true);

drop policy if exists "Authenticated users can add comments" on public.comments;
create policy "Authenticated users can add comments"
  on public.comments for insert
  with check (public.current_user_id() = user_id or public.is_admin());

drop policy if exists "Authors can update own comments" on public.comments;
create policy "Authors can update own comments"
  on public.comments for update
  using (public.current_user_id() = user_id or public.is_admin())
  with check (public.current_user_id() = user_id or public.is_admin());

drop policy if exists "Authors or admin can delete comments" on public.comments;
create policy "Authors or admin can delete comments"
  on public.comments for delete
  using (public.current_user_id() = user_id or public.is_admin());

-- ── 14. Notifications Policies ──────────────────────────────────────────────
drop policy if exists "Users can only read own notifications" on public.notifications;
create policy "Users can only read own notifications"
  on public.notifications for select
  using (public.current_user_id() = user_id or public.is_admin());

drop policy if exists "Notifications can be inserted by system/users/admin" on public.notifications;
create policy "Notifications can be inserted by system/users/admin"
  on public.notifications for insert
  with check (true);

drop policy if exists "Users can update own notification read state" on public.notifications;
create policy "Users can update own notification read state"
  on public.notifications for update
  using (public.current_user_id() = user_id or public.is_admin())
  with check (public.current_user_id() = user_id or public.is_admin());

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
  on public.notifications for delete
  using (public.current_user_id() = user_id or public.is_admin());

-- ── 15. Calls Policies ──────────────────────────────────────────────────────
drop policy if exists "Call participants or admin can view call session" on public.calls;
create policy "Call participants or admin can view call session"
  on public.calls for select
  using (public.current_user_id() = caller_id or public.current_user_id() = receiver_id or public.is_admin());

drop policy if exists "Caller can initiate call" on public.calls;
create policy "Caller can initiate call"
  on public.calls for insert
  with check (public.current_user_id() = caller_id or public.is_admin());

drop policy if exists "Call participants can update call state" on public.calls;
create policy "Call participants can update call state"
  on public.calls for update
  using (public.current_user_id() = caller_id or public.current_user_id() = receiver_id or public.is_admin())
  with check (public.current_user_id() = caller_id or public.current_user_id() = receiver_id or public.is_admin());

-- ── 16. News Articles Policies ──────────────────────────────────────────────
drop policy if exists "News articles viewable by all" on public.news_articles;
create policy "News articles viewable by all"
  on public.news_articles for select
  using (true);

drop policy if exists "Only admins can insert news articles" on public.news_articles;
create policy "Only admins can insert news articles"
  on public.news_articles for insert
  with check (public.is_admin());

drop policy if exists "Only admins can update news articles" on public.news_articles;
create policy "Only admins can update news articles"
  on public.news_articles for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Only admins can delete news articles" on public.news_articles;
create policy "Only admins can delete news articles"
  on public.news_articles for delete
  using (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. Storage Bucket Policies (Private by Default)
-- ═══════════════════════════════════════════════════════════════════════════

-- Ensure social-media bucket exists and is private
insert into storage.buckets (id, name, public)
values ('social-media', 'social-media', false)
on conflict (id) do update set public = false;

-- Storage RLS on storage.objects
drop policy if exists "Authenticated users can read authorized storage" on storage.objects;
create policy "Authenticated users can read authorized storage"
  on storage.objects for select
  using (
    bucket_id = 'social-media'
    and (
      (storage.foldername(name))[1] in ('avatars', 'posts', 'news-articles')
      or (
        (storage.foldername(name))[1] in ('chat', 'credentials')
        and ((storage.foldername(name))[2] = public.current_user_id() or public.is_admin())
      )
    )
  );

drop policy if exists "Users can upload to their own folders" on storage.objects;
create policy "Users can upload to their own folders"
  on storage.objects for insert
  with check (
    bucket_id = 'social-media'
    and (
      (storage.foldername(name))[2] = public.current_user_id()
      or ((storage.foldername(name))[1] = 'news-articles' and public.is_admin())
      or public.is_admin()
    )
  );

drop policy if exists "Users can delete their own files" on storage.objects;
create policy "Users can delete their own files"
  on storage.objects for delete
  using (
    bucket_id = 'social-media'
    and (
      (storage.foldername(name))[2] = public.current_user_id()
      or public.is_admin()
    )
  );
