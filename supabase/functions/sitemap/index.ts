// Supabase Edge Function: sitemap
// Dynamic sitemap.xml for vibedgallery — emits the static top-level routes plus
// one <url> per approved app (/app/:id). Vercel rewrites /sitemap.xml to this
// function so robots.txt and search engines see a single canonical URL.
//
// Public endpoint (verify_jwt = false). Reads only `status='approved'` rows,
// which are already publicly readable under the apps table's RLS policy, so
// the built-in SUPABASE_ANON_KEY is sufficient.
//
// Caching: 10 min browser/edge cache + 1 hour stale-while-revalidate. Keeps
// Googlebot reasonably fresh without hammering Postgres on every crawl.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Sitemap protocol caps a single file at 50,000 URLs. We stay well under that
// — if the gallery ever grows past this point, split into a sitemap index.
const MAX_APP_URLS = 45_000;

// Cache 10 min, allow stale serving for up to 1 hour while revalidating.
const CACHE_CONTROL =
  "public, max-age=600, s-maxage=600, stale-while-revalidate=3600";

const SITE_ORIGIN = (
  Deno.env.get("SITE_ORIGIN") ?? "https://vibedgallery.com"
).replace(/\/$/, "");

// Static routes mirror the previous public/sitemap.xml. Auth-only flows
// (/auth/callback, /reset-password, /forgot-password, /admin) are deliberately
// excluded — they're disallowed in robots.txt.
const STATIC_ROUTES: Array<{
  path: string;
  changefreq: string;
  priority: string;
}> = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/gallery", changefreq: "daily", priority: "0.9" },
  { path: "/how-it-works", changefreq: "monthly", priority: "0.6" },
  { path: "/about", changefreq: "monthly", priority: "0.5" },
  { path: "/submit", changefreq: "monthly", priority: "0.5" },
  { path: "/login", changefreq: "yearly", priority: "0.3" },
  { path: "/register", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.2" },
  { path: "/privacy", changefreq: "yearly", priority: "0.2" },
];

interface AppRow {
  id: string;
  user_id: string | null;
  updated_at: string | null;
  created_at: string | null;
}

interface MakerRow {
  user_id: string;
  lastmod: string | null;
}

function isoDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // W3C Datetime format — full ISO 8601 is accepted by sitemap.org.
  return d.toISOString();
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Derive one MakerRow per distinct creator who has at least one approved app.
// lastmod is the most recent app updated_at|created_at across that creator's
// approved apps, so crawlers see "this maker page may have changed."
function deriveMakers(apps: AppRow[]): MakerRow[] {
  const byUser = new Map<string, string | null>();
  for (const app of apps) {
    if (!app.user_id) continue;
    const lm = isoDate(app.updated_at) ?? isoDate(app.created_at);
    const prev = byUser.get(app.user_id);
    if (prev === undefined || (lm && (!prev || lm > prev))) {
      byUser.set(app.user_id, lm);
    }
  }
  return Array.from(byUser.entries()).map(([user_id, lastmod]) => ({
    user_id,
    lastmod,
  }));
}

function buildSitemap(apps: AppRow[]): string {
  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

  for (const route of STATIC_ROUTES) {
    parts.push("  <url>");
    parts.push(`    <loc>${escapeXml(SITE_ORIGIN + route.path)}</loc>`);
    parts.push(`    <changefreq>${route.changefreq}</changefreq>`);
    parts.push(`    <priority>${route.priority}</priority>`);
    parts.push("  </url>");
  }

  for (const app of apps) {
    const lastmod = isoDate(app.updated_at) ?? isoDate(app.created_at);
    parts.push("  <url>");
    parts.push(
      `    <loc>${escapeXml(`${SITE_ORIGIN}/app/${app.id}`)}</loc>`,
    );
    if (lastmod) {
      parts.push(`    <lastmod>${lastmod}</lastmod>`);
    }
    parts.push("    <changefreq>weekly</changefreq>");
    parts.push("    <priority>0.7</priority>");
    parts.push("  </url>");
  }

  // Creator/maker pages — one per distinct user_id with at least one approved
  // app. Lets search engines discover and index portfolios alongside apps.
  for (const maker of deriveMakers(apps)) {
    parts.push("  <url>");
    parts.push(
      `    <loc>${escapeXml(`${SITE_ORIGIN}/maker/${maker.user_id}`)}</loc>`,
    );
    if (maker.lastmod) {
      parts.push(`    <lastmod>${maker.lastmod}</lastmod>`);
    }
    parts.push("    <changefreq>weekly</changefreq>");
    parts.push("    <priority>0.5</priority>");
    parts.push("  </url>");
  }

  parts.push("</urlset>");
  return parts.join("\n");
}

function xmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": status === 200 ? CACHE_CONTROL : "no-store",
      // Sitemaps are fetched cross-origin by crawlers and dev tooling; this
      // matches the other public functions in this project.
      "Access-Control-Allow-Origin": "*",
    },
  });
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    // Misconfiguration — degrade to a sitemap containing only the static
    // routes so crawlers still get something useful.
    return xmlResponse(buildSitemap([]));
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("apps")
    .select("id, user_id, updated_at, created_at")
    .eq("status", "approved")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(MAX_APP_URLS);

  if (error) {
    console.error("sitemap: failed to load approved apps", error);
    // Fall back to static-only sitemap rather than 500ing the crawler.
    return xmlResponse(buildSitemap([]));
  }

  return xmlResponse(buildSitemap((data ?? []) as AppRow[]));
});
