-- ─────────────────────────────────────────────────────────────────────
-- Seed 24 demo apps so first-visit doesn't see a ghost town.
-- ─────────────────────────────────────────────────────────────────────
-- All rows:
--   - Owned by the existing admin user, so Maker pages resolve.
--   - status='approved', ownership_verified=true → visible immediately.
--   - tagged with 'demo' for trivial cleanup later:
--       DELETE FROM apps WHERE 'demo' = ANY(tags);
--   - thumbnails come from picsum.photos's deterministic seeded URLs,
--     which gives stable images without us hosting anything.
--
-- Guarded by NOT EXISTS so the migration is idempotent — running it twice
-- doesn't double the rows.

WITH owner_row AS (
  SELECT id, email
  FROM auth.users
  WHERE email = 'ermddan@gmail.com'
  LIMIT 1
),
seed (title, tagline, description, url, category, primary_tool, slug, upvotes) AS (
  VALUES
    ('Synapse',        'Visual graph editor for your second brain.',
     'A keyboard-first knowledge graph that turns scattered notes into a navigable map. Open a node, dive into its connections, and never lose context again.',
     'https://synapse.app', 'Productivity', 'Cursor', 'synapse', 47),
    ('Brushstroke',    'AI-assisted vector illustration in the browser.',
     'Draw with bezier precision while a model fills in the boring parts. Exports clean SVGs you can drop straight into Figma.',
     'https://brushstroke.io', 'Creative', 'Lovable', 'brushstroke', 33),
    ('Loop',           'Habit tracker with exactly one tap a day.',
     'No streaks to flex, no leaderboard, no notifications. Just a single dot you tap when you do the thing.',
     'https://looptracker.app', 'Productivity', 'Bolt', 'loop', 28),
    ('Codemark',       'Bookmarks for code snippets and their context.',
     'Save a function with its file, line, and the commit it lived in. Search later by what it did, not what it was called.',
     'https://codemark.dev', 'Developer Tool', 'Cursor', 'codemark', 51),
    ('Pixie',          'A pixel-art editor that fits inside a tab.',
     'Sprite sheets, animation frames, palette tools — under 60KB of JS, runs offline.',
     'https://pixie.gallery', 'Creative', 'v0', 'pixie', 19),
    ('Inkwell',        'Distraction-free markdown for long writing.',
     'No toolbar, no sidebar, no AI rewriting your prose. Just text, autosave, and a wordcount that disappears when you stop looking at it.',
     'https://inkwell.page', 'Productivity', 'Claude', 'inkwell', 42),
    ('Riff',           'Generate guitar tabs from a hummed melody.',
     'Hum into your mic, get a tab in 4/4 with chord suggestions. Works on acoustic, electric, or bass.',
     'https://riff.studio', 'Creative', 'ChatGPT', 'riff', 24),
    ('Crawler',        'Headless SERP scraper with a one-line setup.',
     'Self-hosted, proxy-rotating Google/Bing results pipeline. Built for indie SEO tools that can''t pay enterprise prices.',
     'https://crawler.lat', 'Developer Tool', 'Cursor', 'crawler', 36),
    ('Pintar',         'Flashcards with native-speaker audio.',
     'Spaced repetition for Bahasa Indonesia, Tagalog, and Vietnamese. Audio is from real humans, not TTS.',
     'https://pintar.app', 'Education', 'Lovable', 'pintar', 16),
    ('Mocha',          'Hand-drawn UI prototype tool.',
     'A whiteboard that recognises common UI shapes and makes them tappable. Export to PNG or a clickable demo link.',
     'https://mocha.design', 'Creative', 'Bolt', 'mocha', 31),
    ('Threadly',       'Cross-post to Threads, X, and Bluesky in one keystroke.',
     'Write once, schedule to all three, see analytics side-by-side. No bring-your-own-API headaches.',
     'https://threadly.dev', 'Social', 'v0', 'threadly', 22),
    ('Cheq',           'Restaurant tab splitter, no signup.',
     'Drop a photo of the receipt, drag items to people, see who owes what. Venmo links built in.',
     'https://cheq.team', 'Finance', 'Bolt', 'cheq', 18),
    ('Pulse',          'Workout timer for HIIT and strength sets.',
     'Big numbers, voice cues, runs as a PWA on a locked phone. No subscription, no upsell.',
     'https://pulse.fit', 'Health', 'Replit', 'pulse', 14),
    ('Cipher',         'A password manager built for one device.',
     'Local-only encrypted vault, no cloud sync. For people who want a password manager but not another company holding their keys.',
     'https://cipher.local', 'Productivity', 'Claude', 'cipher', 39),
    ('Glyph',          'Type a letterform, get every font that ships it.',
     'Reverse font search: paste a glyph, see which Google Fonts and Adobe fonts include it. Filter by weight and license.',
     'https://glyph.fyi', 'Creative', 'Cursor', 'glyph', 27),
    ('Stack',          'Recipe finder by what''s actually in your fridge.',
     'Tell it what you have, get recipes you can make right now. No "1 tsp of tarragon" if you don''t have tarragon.',
     'https://stack.kitchen', 'Other', 'Gemini', 'stack', 23),
    ('Pomodoro Black', 'Brutalist pomodoro timer for the web and Mac.',
     'Twenty-five minutes, a hard cut, and a black screen. No animations, no ambient music, no streaks.',
     'https://pomodoroblack.com', 'Productivity', 'Cursor', 'pomodoroblack', 45),
    ('Folio',          'Photographer''s contact-sheet portfolio host.',
     'Upload a folder, get a portfolio that looks like a darkroom contact sheet. Custom domain in two clicks.',
     'https://folio.gallery', 'Creative', 'Lovable', 'folio', 30),
    ('Beats',          'A drum machine that lives in localhost.',
     'Open-source, MIDI-out, sample-pack friendly. Designed for the corner of your monitor while you work.',
     'https://beats.work', 'Creative', 'Replit', 'beats', 12),
    ('Quil',           'A bug tracker for solo founders.',
     'Three columns, keyboard shortcuts, Linear-fast. No epics, no sprints, no Jira inheritance.',
     'https://quil.app', 'Developer Tool', 'Cursor', 'quil', 38),
    ('Dewey',          'A library system for your physical books.',
     'Scan ISBN barcodes with your phone, get a private OPAC-style catalogue. Lend tracking included.',
     'https://dewey.shelf', 'Other', 'Lovable', 'dewey', 17),
    ('Lattice',        'A board games scheduler for friend groups.',
     'Polls for next game night, automatic ICS invites, a wishlist that connects to BoardGameGeek.',
     'https://lattice.games', 'Social', 'Bolt', 'lattice', 21),
    ('Ribbon',         'Holiday cards designer with print-on-demand.',
     'Templates that don''t scream Canva, photo composition help, mailed to your list directly. December-ready.',
     'https://ribbon.cards', 'Creative', 'v0', 'ribbon', 26),
    ('Mango',          'An expense tracker that doesn''t yell at you.',
     'Plain-text import, no budget shaming, no gamification. Just a ledger that adds up.',
     'https://mango.money', 'Finance', 'Cursor', 'mango', 34)
)
INSERT INTO public.apps (
  user_id, title, tagline, description, url, category, tags,
  primary_tool, thumbnail_url,
  status, ownership_verified,
  safe_browsing_passed, safe_browsing_threats,
  upvotes, views,
  created_at
)
SELECT
  o.id,
  s.title,
  s.tagline,
  s.description,
  s.url,
  s.category,
  ARRAY['demo']::text[],
  s.primary_tool,
  format('https://picsum.photos/seed/%s/1200/675', s.slug),
  'approved',
  true,
  true,
  ARRAY[]::text[],
  s.upvotes,
  s.upvotes * 8 + (random() * 50)::int,  -- realistic-looking view counts
  now() - (interval '1 hour' * (random() * 720)::int)  -- staggered over ~30 days
FROM seed s
CROSS JOIN owner_row o
WHERE NOT EXISTS (
  SELECT 1 FROM public.apps a WHERE a.url = s.url
);
