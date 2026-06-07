// Supabase Edge Function: og-app
// Server-rendered Open Graph preview page for an app — reachable via the pretty
// /:username/:slug URL or the legacy /app/:id. Vercel rewrites the
// request here only when the User-Agent matches a known social-card crawler
// (Twitter/Slack/Discord/Facebook/LinkedIn/etc.), so real human visitors keep
// hitting the SPA. Crawlers don't run JavaScript, so the client-side
// usePageMeta() they would otherwise see is a no-op — without this function
// every shared /app/:id link shares the generic site-wide og:image and title.
//
// Public endpoint (verify_jwt = false). Reads only `status='approved'` rows,
// which are already publicly readable under the apps table's RLS policy, so
// the built-in SUPABASE_ANON_KEY is sufficient.
//
// The response also renders a tiny visible body (heading + link back to the
// SPA) so a misdirected human-with-a-bot-UA isn't staring at a blank page.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_ORIGIN = (
  Deno.env.get("SITE_ORIGIN") ?? "https://www.vibedgallery.com"
).replace(/\/$/, "");

const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-image.png`;
const SITE_NAME = "VibedGallery";

// 10 min browser/edge cache, 1 hour stale-while-revalidate. Matches sitemap's
// posture — crawlers that re-fetch frequently still get reasonably fresh
// content, but we don't hammer Postgres on every social-card pre-render.
const CACHE_CONTROL =
  "public, max-age=600, s-maxage=600, stale-while-revalidate=3600";

interface AppRow {
  id: string;
  slug: string | null;
  title: string;
  tagline: string | null;
  description: string | null;
  category: string | null;
  primary_tool: string | null;
  thumbnail_url: string | null;
  tags: string[] | null;
  created_at: string | null;
  status: string;
  // Embedded maker handle via apps.user_id -> profiles.id FK.
  maker: { username: string | null } | null;
}

// Columns + embedded maker handle. Shared by both lookup paths so either can
// build the canonical pretty URL. We embed the public_profiles VIEW (not
// profiles) since anon is RLS-blocked from reading profiles directly; PostgREST
// resolves the relationship via the apps.user_id -> profiles.id FK.
const APP_SELECT =
  "id, slug, title, tagline, description, category, primary_tool, thumbnail_url, tags, created_at, status, " +
  "maker:public_profiles(username)";

// Canonical URL for an app: the pretty /<username>/<slug> when both are known,
// else the legacy /app/<id> (which the SPA redirects to the pretty URL).
function canonicalUrl(app: AppRow): string {
  const username = app.maker?.username;
  if (username && app.slug) return `${SITE_ORIGIN}/${username}/${app.slug}`;
  return `${SITE_ORIGIN}/app/${app.id}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Trim to a sensible meta-description length so crawlers don't truncate
// mid-sentence, AND collapse whitespace + strip markdown noise so the
// description renders as one clean line in social cards. 200 chars is well
// within Twitter's and Facebook's limits.
function clampDescription(s: string | null | undefined, max = 200): string {
  let t = (s ?? "")
    .replace(/[#*_>`]/g, " ")          // strip common markdown markers
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1") // links: keep text, drop URL
    .replace(/\s+/g, " ")              // collapse whitespace + newlines
    .trim();
  if (t.length <= max) return t;
  t = t.slice(0, max - 1).trimEnd();
  return t + "…";
}

// Validate the app id looks like a uuid before we touch the DB — protects
// against ridiculous query strings being sent to PostgREST.
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": status === 200 ? CACHE_CONTROL : "no-store",
      "Access-Control-Allow-Origin": "*",
      // Crawlers may follow this URL directly; this nudges them back to the
      // canonical SPA URL when they index the page.
      "X-Robots-Tag": status === 200 ? "index,follow" : "noindex",
    },
  });
}

function buildPage(app: AppRow): string {
  const canonical = canonicalUrl(app);
  const title = app.title || "App";
  const tagline = app.tagline || "";
  const subtitle = tagline || app.category || "";
  const description = clampDescription(
    app.description || tagline || `${title} — built with ${app.primary_tool || "AI"}.`
  );
  const fullTitle = `${title} — ${tagline || app.category || SITE_NAME}`;
  const image = app.thumbnail_url || DEFAULT_OG_IMAGE;
  const keywords = [app.category, app.primary_tool, ...(app.tags || [])]
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .join(", ");

  // Structured data mirrors the client's usePageMeta CreativeWork block so a
  // crawler that doesn't run JS still picks the same schema up.
  const ld = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: title,
    headline: title,
    description: description,
    image: image,
    url: canonical,
    datePublished: app.created_at || undefined,
    genre: app.category || undefined,
    keywords: keywords || undefined,
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(fullTitle)} — ${escapeHtml(SITE_NAME)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
  <meta property="og:title" content="${escapeHtml(fullTitle)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:alt" content="${escapeHtml(title)}" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(fullTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />

  ${keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}" />` : ""}

  <script type="application/ld+json">${escapeHtml(JSON.stringify(ld))}</script>

  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color:#000; background:#fff; margin:0; padding:40px 24px; line-height:1.5; }
    .wrap { max-width: 720px; margin: 0 auto; }
    .meta { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; color:#717171; }
    h1 { font-size:36px; font-weight:900; text-transform:uppercase; letter-spacing:-0.04em; line-height:1.05; margin:8px 0 16px; }
    p.sub { font-size:16px; color:#717171; margin:0 0 24px; }
    img { max-width:100%; height:auto; border:1px solid #E5E5E5; }
    a { color:#000; font-weight:700; text-decoration:underline; text-underline-offset:4px; }
  </style>
</head>
<body>
  <div class="wrap">
    <p class="meta">${escapeHtml(SITE_NAME)} · ${escapeHtml(app.category || "")}</p>
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="sub">${escapeHtml(subtitle)}</p>` : ""}
    ${app.thumbnail_url ? `<img src="${escapeHtml(app.thumbnail_url)}" alt="${escapeHtml(title)}" />` : ""}
    <p style="margin-top:24px;"><a href="${escapeHtml(canonical)}">Open ${escapeHtml(title)} on ${escapeHtml(SITE_NAME)} →</a></p>
  </div>
</body>
</html>`;
}

function buildNotFound(): string {
  const canonical = `${SITE_ORIGIN}/gallery`;
  const title = "App not found";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)} — ${escapeHtml(SITE_NAME)}</title>
  <meta name="robots" content="noindex,nofollow" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta property="og:title" content="${escapeHtml(title)} — ${escapeHtml(SITE_NAME)}" />
  <meta property="og:description" content="This app isn't in the gallery." />
  <meta property="og:image" content="${escapeHtml(DEFAULT_OG_IMAGE)}" />
</head>
<body>
  <p>App not found. <a href="${escapeHtml(canonical)}">Back to gallery</a>.</p>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      },
    });
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Two entry shapes, both gated to crawlers by the Vercel rewrite:
  //   • Pretty:  /:username/:slug  ->  ?username=:username&slug=:slug
  //   • Legacy:  /app/:id          ->  ?id=:id
  // We also accept the raw path forms so the function can be curl-tested
  // directly without going through Vercel's rewrites.
  const url = new URL(req.url);
  let id = (url.searchParams.get("id") || "").trim();
  let username = (url.searchParams.get("username") || "").trim().toLowerCase();
  let slug = (url.searchParams.get("slug") || "").trim().toLowerCase();

  if (!id && !(username && slug)) {
    const legacy = url.pathname.match(/\/app\/([^/?#]+)/);
    if (legacy) {
      id = legacy[1].trim();
    } else {
      // Generic two-segment path: /:username/:slug
      const seg = url.pathname.split("/").filter(Boolean);
      if (seg.length === 2) {
        username = decodeURIComponent(seg[0]).toLowerCase();
        slug = decodeURIComponent(seg[1]).toLowerCase();
      }
    }
  }

  // Need either a valid UUID id or a username+slug pair.
  const hasId = id && UUID_RE.test(id);
  if (!hasId && !(username && slug)) {
    return htmlResponse(buildNotFound(), 404);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return htmlResponse(buildNotFound(), 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = supabase.from("apps").select(APP_SELECT).eq("status", "approved");
  if (hasId) {
    query = query.eq("id", id);
  } else {
    // username lives on the embedded profiles row; !inner makes it a filterable
    // join. (username, slug) is globally unique.
    query = supabase
      .from("apps")
      .select(
        "id, slug, title, tagline, description, category, primary_tool, thumbnail_url, tags, created_at, status, " +
          "maker:public_profiles!inner(username)",
      )
      .eq("status", "approved")
      .eq("slug", slug)
      .eq("maker.username", username);
  }

  const { data, error } = await query.maybeSingle<AppRow>();

  if (error) {
    console.error("og-app: lookup failed", error);
    return htmlResponse(buildNotFound(), 500);
  }
  if (!data) {
    return htmlResponse(buildNotFound(), 404);
  }

  return htmlResponse(buildPage(data));
});
