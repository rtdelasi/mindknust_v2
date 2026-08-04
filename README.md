# CounselCare

Expo SDK 54 counselor booking app scaffold with Expo Router and Supabase.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add Supabase env vars:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

3. Start the app:

```bash
npx expo start
```

## Routes

### Student (`(tabs)`)
- `Home` - `src/app/(tabs)/index.tsx`
- `Search Counselor` - `src/app/(tabs)/search.tsx`
- `My Sessions` - `src/app/(tabs)/sessions.tsx`
- `Messages` - `src/app/(tabs)/chats.tsx`
- `Profile` - `src/app/(tabs)/profile.tsx`
- `Approvals` (admin only) - `src/app/(tabs)/approvals.tsx`

### Counselor (`(counselor-tabs)`)
- `Dashboard` - `src/app/(counselor-tabs)/index.tsx`
- `Schedule` - `src/app/(counselor-tabs)/schedule.tsx`
- `Sessions` - `src/app/(counselor-tabs)/sessions.tsx`
- `Messages` - `src/app/(counselor-tabs)/chats.tsx`
- `Profile` - `src/app/(counselor-tabs)/profile.tsx`
- `Pending approval` - `src/app/counselor-pending.tsx`

### Shared
- `Login` / `Register` - `src/app/(auth)/`
- `Video Call` - `src/app/video-call.tsx`
- `Booking` - `src/app/booking/[counselor].tsx`
- `Chat thread` - `src/app/chat/[id].tsx`
- `Social feed` / `Post` - `src/app/social-feed.tsx`, `src/app/post/[id].tsx`
- `AI chatbot` - `src/app/ai-chatbot.tsx`
- `Mood history` - `src/app/mood-history.tsx`
- `Notifications` - `src/app/notifications.tsx`

## Admin dashboard

A separate Vite + React app lives in `admin-dashboard/` with its own
dependencies and `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`):

```bash
cd admin-dashboard
npm install
npm run dev
```

## Security note

`supabase_schema.sql` disables row-level security and grants full access to the
`anon` role for sandbox development. The anon key ships in the app bundle, so
this configuration must not be deployed to production — see the warning block
in that file for remediation options.

