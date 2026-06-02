# Vibe Gallery

**Welcome to VibeGallery** 

**About**

VibedGallery is a gallery for vibecoded apps - a place where developers can submit and showcase their vibecoded applications built with various platforms like Lovable, Cursor, Windsurf, and others.

**Getting Started**

This project contains everything you need to run VibedGallery locally.

**Prerequisites:** 

1. Clone the repository using the project's Git URL 
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Create an `.env.local` file and set the environment variables (if needed for your backend)

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APP_BASE_URL=your_backend_url
```

> Note: never put the Google Safe Browsing key in client env. It is a
> server-side secret (see below).

Run the app: `npm run dev`

**Server-side secrets (Supabase Edge Functions)**

The Safe Browsing and ownership-verification checks run in Supabase Edge
Functions so their secrets never reach the browser. Set them with the
Supabase CLI (or via Dashboard → Project Settings → Edge Functions → Secrets):

```
supabase secrets set GOOGLE_SAFE_BROWSING_KEY=your_google_safe_browsing_key
```

Deploy the functions:

```
supabase functions deploy safe-browsing
supabase functions deploy verify-ownership
```

**Development**

- Build: `npm run build`
- Lint: `npm run lint`
- Type check: `npm run typecheck`
- Preview: `npm run preview`

**Features**

- View vibecoded apps in a beautiful gallery
- Filter by framework (Trending, Newest, Cursor, Windsurf, Lovable, etc.)
- User authentication
- Submit and manage your vibecoded apps

**Support**

For issues or questions, please open an issue on GitHub.

