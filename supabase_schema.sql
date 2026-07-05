-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Create Profiles Table (Can store both students and counselors)
create table if not exists public.profiles (
  id text primary key, -- Matches Auth UID (from Firebase or Supabase auth)
  name text not null,
  email text not null unique,
  role text not null check (role in ('student', 'counselor')),
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Counselors Metadata Table
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
  user_id text references public.profiles(id) on delete cascade
);

-- Alterations for Sentiment and Moderation Engine
alter table if exists public.mood_logs add column if not exists sentiment_score numeric(3,2) default 0.00;
alter table if exists public.mood_logs add column if not exists sentiment_label text default 'neutral';
alter table if exists public.mood_logs add column if not exists is_flagged boolean default false;

alter table if exists public.posts add column if not exists moderation_status text default 'approved';
alter table if exists public.posts add column if not exists is_flagged boolean default false;
alter table if exists public.posts add column if not exists flag_reason text;
alter table if exists public.notifications disable row level security;
