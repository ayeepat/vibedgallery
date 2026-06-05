# VibedGallery

A gallery for apps built with AI coding tools — Cursor, Windsurf, Lovable, Bolt, Replit, Claude, ChatGPT, Gemini, v0, and others. Submit a live URL, prove you own the site with a verification file, and get listed once a human admin approves.

## Stack

- **Frontend**: React 18 + Vite 6, React Router 6, TanStack Query 5, Tailwind CSS 3, framer-motion, shadcn/ui (Radix primitives), lucide-react.
- **Backend**: Supabase — Postgres + RLS for storage, Storage bucket `app-images` for uploads, four Edge Functions (Deno) for server-side work.
- **Anti-abuse**: Cloudflare Turnstile (captcha) on register + submit, Google Safe Browsing on submitted URLs, server-side ownership verification (Google-style HTML/TXT file).
- **Mail**: Resend, called from the `send-email` Edge Function.

## Local development

Prereqs: Node 20+, npm.

```bash
npm install
cp .env.local.example .env.local   # then fill in the values
npm run dev                        # http://localhost:5173
```

Required env (see `.env.local.example`):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_TURNSTILE_SITE_KEY=           # leave blank to bypass captcha in dev
VITE_APP_BASE_URL=http://localhost:5173
```

`.env.local` is **gitignored** — never commit secrets, even publishable ones.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production bundle to `dist/` |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | ESLint (errors only) |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run typecheck` | `tsc --checkJs` over the JSX sources |

## Project layout

```
src/
  App.jsx              # routes + providers
  main.jsx             # bootstrap
  pages/               # Home, Gallery, AppDetail, Submit, Admin, Profile, Maker, auth pages
  components/
    Nav.jsx, SearchBar.jsx, Turnstile.jsx, ProtectedRoute.jsx, ErrorBoundary.jsx, …
    ui/                # shadcn/ui primitives
  lib/
    supabaseClient.js  # singleton supabase-js client
    AuthContext.jsx    # session + profile + auth methods
    useApps.js         # TanStack Query hooks for the apps table
    edgeFunctions.js   # thin wrappers around the four Edge Functions
    safeBrowsing.js, verifyOwnership.js, imageCheck.js
supabase/
  config.toml
  functions/
    send-email/        # transactional mail (Resend); JWT + RLS-aware
    verify-html/       # server-side ownership file check (no CORS)
    verify-turnstile/  # captcha verification
    check-url-safety/  # Google Safe Browsing wrapper
```

## Submission flow

1. User fills the form on `/submit`, captcha-verifies, URL is checked against Safe Browsing.
2. Row inserted with `status = 'pending_verification'`. A verification token (128 bits, hex-encoded) is generated client-side.
3. User downloads `<token>.html`, deploys it under their site's `/public` folder.
4. Clicking *I've Deployed The File* transitions the row to `pending_review` and marks `ownership_verified` optimistically.
5. Admin (`profiles.role = 'admin'`) opens `/admin`, runs the verify-html Edge Function against the live URL, then approves or rejects with a reason. The submitter is emailed in both cases.

## Edge Function secrets

Set via `supabase secrets set` on the project:

| Secret | Used by | Notes |
|---|---|---|
| `RESEND_API_KEY` | send-email | Required |
| `EMAIL_FROM` | send-email | `Name <addr@verified-domain>` |
| `ADMIN_EMAIL` | send-email | Recipient for `admin_notification` |
| `TURNSTILE_SECRET_KEY` | verify-turnstile | Cloudflare secret key |
| `GOOGLE_SAFE_BROWSING_KEY` | check-url-safety | Optional — if unset, the function returns `skipped:true` and the client treats the URL as safe |
| `GOOGLE_CLOUD_VISION_KEY` | check-image-safety | Optional — if unset, the function returns `skipped:true` and the client treats the image as safe (admin still spot-checks in the queue) |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by the platform; do not set them manually.

## Database

Tables (all RLS-enabled):

- `public.profiles` — 1:1 with `auth.users`. `role` ∈ {`user`, `admin`}.
- `public.apps` — submitted apps. `status` ∈ {`pending_verification`, `pending_review`, `approved`, `rejected`}.
- `public.upvotes` — one row per (user, app).
- `public.public_profiles` — view exposing safe profile fields; `security_invoker = true`.

Image uploads live in the `app-images` storage bucket (`public`). The bucket has no broad SELECT policy — public URLs are served via CDN, but API enumeration is blocked.

## Deploy

The frontend is a static SPA. Any static host (Vercel, Netlify, Cloudflare Pages) works:

```
npm run build
# upload dist/
```

Set the production env vars on the host (the `VITE_*` set above) and point the SPA at the same Supabase project.

Before going live, walk through the **pre-launch checklist** below.

## Pre-launch checklist

- [ ] `npm run build` and `npm run lint` clean
- [ ] Supabase advisors: 0 ERRORs, 0 high-impact WARNs (`mcp__supabase__get_advisors` or Dashboard → Advisors)
- [ ] Auth → "Prevent use of leaked passwords" enabled
- [ ] Auth → "Secure password change" (require current password) enabled
- [ ] All five Edge Function secrets set
- [ ] Resend domain verified, `EMAIL_FROM` matches
- [ ] Turnstile site key configured for the production hostname
- [ ] Smoke test, against the real Supabase project:
  - [ ] Register → email OTP → land on `/`
  - [ ] Submit a real URL (captcha + Safe Browsing + image upload)
  - [ ] Deploy the verification file to that URL
  - [ ] Admin runs Re-Run Verification Check → green
  - [ ] Approve → submitter receives the approval email
  - [ ] Upvote / un-upvote a live app
