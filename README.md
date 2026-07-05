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

- `Home` - `src/app/(tabs)/index.tsx`
- `Search Counselor` - `src/app/(tabs)/search.tsx`
- `My Sessions` - `src/app/(tabs)/sessions.tsx`
- `Profile` - `src/app/(tabs)/profile.tsx`
- `Video Call` - `src/app/video-call.tsx`
- `Booking` - `src/app/booking/[counselor].tsx`
