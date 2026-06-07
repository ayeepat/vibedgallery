// Small, dependency-free URL helpers shared across the app. Kept pure so they
// can be unit-tested in isolation.

// Normalize a user-typed site URL: trim, and prepend https:// when no scheme
// is present so "myapp.com" becomes "https://myapp.com".
export function normalizeUrl(input) {
  if (!input) return "";
  let url = String(input).trim();
  if (url.length < 3) return url;
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  return url;
}

// Sanitize a free-text search term before it's interpolated into a PostgREST
// `or()` / `ilike` filter. Strips the meta chars that break or could be coerced
// across that syntax — commas, parens, colons, asterisks, SQL LIKE wildcards
// (% _ \) and the `.` field separator — then bounds the length. Returns a
// string safe to wrap in `%term%`.
export function sanitizeSearchTerm(input, maxLength = 80) {
  return String(input ?? "")
    .trim()
    .replace(/[,()*:%_\\.]/g, "")
    .slice(0, maxLength);
}

// ─── Pretty app URLs: /<username>/<appslug> ───────────────────────────────
// Usernames (maker handles) are global + case-insensitive; app slugs are unique
// per maker. Both are stored lowercased/canonical in the DB, and the regexes +
// reserved list here MIRROR the profiles_username_format / apps_slug_format
// CHECK constraints. Keep the two in sync if either changes.

// Usernames that would collide with a real top-level route or Vercel rewrite,
// so a maker can't claim e.g. /app/... or /maker/... as their handle.
export const RESERVED_USERNAMES = new Set([
  "app", "apps", "maker", "makers", "tag", "tags", "auth", "gallery", "submit",
  "admin", "profile", "login", "register", "about", "how-it-works",
  "forgot-password", "reset-password", "privacy", "terms", "api", "www",
  "sitemap", "assets", "static", "public", "og-app",
]);

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])$/; // 3–30 chars
const SLUG_RE = /^[a-z0-9](?:[a-z0-9_-]{0,58}[a-z0-9])?$/;     // 1–60 chars

// Turn free text into a URL-safe slug: lowercase, non-alphanumerics → "-",
// collapse/trim hyphens, cap at 60 chars. Used to pre-fill the submit form's
// username (from display name) and slug (from app title).
export function slugify(input, maxLength = 60) {
  return String(input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // any run of non-alnum becomes a single dash
    .replace(/^-+|-+$/g, "")     // trim leading/trailing dashes
    .slice(0, maxLength)
    .replace(/-+$/g, "");        // re-trim in case the slice left a trailing dash
}

// A handle is valid if it matches the format AND isn't reserved. Mirrors the DB.
export function isValidUsername(u) {
  return typeof u === "string" && USERNAME_RE.test(u) && !RESERVED_USERNAMES.has(u);
}

export function isValidSlug(s) {
  return typeof s === "string" && SLUG_RE.test(s);
}

// Single source of truth for an app's in-app link. Returns the pretty
// /<username>/<slug> path when both parts are known (username from the app row
// or an explicit fallback, e.g. the owner's profile.username on their own
// pages), otherwise the legacy /app/<id> path — which AppDetail redirects to
// the pretty URL once the row resolves.
export function appPath(app, fallbackUsername = null) {
  if (!app) return "/gallery";
  const username = app.username || fallbackUsername;
  if (username && app.slug) {
    return `/${username}/${app.slug}`;
  }
  return `/app/${app.id}`;
}

// Validate a post-auth / post-action redirect target so an attacker can't use a
// `?from=` / stashed path to bounce the user to another origin (open redirect).
// Only same-origin absolute paths are allowed; everything else falls back.
//
// Rejects:
//   - non-strings / empty
//   - anything not starting with a single "/"
//   - protocol-relative ("//evil.com") and backslash tricks ("/\evil.com")
//   - control characters that can confuse downstream parsers
export function sanitizeRedirectPath(path, fallback = "/") {
  if (typeof path !== "string" || path.length === 0) return fallback;
  if (path[0] !== "/") return fallback;
  if (path[1] === "/" || path[1] === "\\") return fallback;
  for (let i = 0; i < path.length; i++) {
    const c = path.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return fallback; // control chars
  }
  return path;
}
