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
