import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeUrl,
  sanitizeRedirectPath,
  sanitizeSearchTerm,
  slugify,
  isValidUsername,
  isValidSlug,
  appPath,
  RESERVED_USERNAMES,
} from "../src/lib/urlHelpers.js";

const NL = String.fromCharCode(10); // newline
const TAB = String.fromCharCode(9); // tab

test("normalizeUrl prepends https:// when scheme missing", () => {
  assert.equal(normalizeUrl("myapp.com"), "https://myapp.com");
  assert.equal(normalizeUrl("  spaced.com  "), "https://spaced.com");
});

test("normalizeUrl preserves an existing scheme", () => {
  assert.equal(normalizeUrl("http://x.com"), "http://x.com");
  assert.equal(normalizeUrl("HTTPS://X.com/y"), "HTTPS://X.com/y");
});

test("normalizeUrl handles empty / tiny input", () => {
  assert.equal(normalizeUrl(""), "");
  assert.equal(normalizeUrl(null), "");
  assert.equal(normalizeUrl("ab"), "ab");
});

test("sanitizeRedirectPath allows same-origin paths", () => {
  assert.equal(sanitizeRedirectPath("/gallery"), "/gallery");
  assert.equal(sanitizeRedirectPath("/app/123?x=1#a"), "/app/123?x=1#a");
});

test("sanitizeRedirectPath rejects open-redirect attempts", () => {
  assert.equal(sanitizeRedirectPath("//evil.com"), "/");
  assert.equal(sanitizeRedirectPath("/\\evil.com"), "/");
  assert.equal(sanitizeRedirectPath("https://evil.com"), "/");
  assert.equal(sanitizeRedirectPath("http://evil.com"), "/");
  assert.equal(sanitizeRedirectPath("gallery"), "/");
});

test("sanitizeRedirectPath rejects empty / non-string / control chars", () => {
  assert.equal(sanitizeRedirectPath(""), "/");
  assert.equal(sanitizeRedirectPath(null), "/");
  assert.equal(sanitizeRedirectPath(undefined), "/");
  assert.equal(sanitizeRedirectPath("/a" + NL + "b"), "/");
  assert.equal(sanitizeRedirectPath("/a" + TAB + "b"), "/");
});

test("sanitizeRedirectPath honors a custom fallback", () => {
  assert.equal(sanitizeRedirectPath("//evil.com", "/home"), "/home");
});

test("sanitizeSearchTerm strips PostgREST/LIKE meta chars and the field separator", () => {
  // Commas, parens, colons, asterisks, % _ \ and `.` must all be removed so the
  // term can't break out of the `or(col.ilike.%term%)` filter.
  assert.equal(sanitizeSearchTerm("title.ilike.*,admin"), "titleilikeadmin");
  assert.equal(sanitizeSearchTerm("a%b_c\\d"), "abcd");
  assert.equal(sanitizeSearchTerm("(foo):bar"), "foobar");
});

test("sanitizeSearchTerm trims and keeps ordinary words", () => {
  assert.equal(sanitizeSearchTerm("  crm tool  "), "crm tool");
  assert.equal(sanitizeSearchTerm("Productivity"), "Productivity");
});

test("sanitizeSearchTerm bounds the length", () => {
  assert.equal(sanitizeSearchTerm("x".repeat(200)).length, 80);
  assert.equal(sanitizeSearchTerm("x".repeat(200), 10).length, 10);
});

test("sanitizeSearchTerm handles empty / non-string input", () => {
  assert.equal(sanitizeSearchTerm(""), "");
  assert.equal(sanitizeSearchTerm(null), "");
  assert.equal(sanitizeSearchTerm(undefined), "");
});

// ─── Pretty-URL helpers ──────────────────────────────────────────────────

test("slugify lowercases, dashes non-alnum, trims edge dashes", () => {
  assert.equal(slugify("My Awesome App"), "my-awesome-app");
  assert.equal(slugify("  Hello, World!  "), "hello-world");
  assert.equal(slugify("Zeid Diez"), "zeid-diez");
  assert.equal(slugify("a___b   c"), "a-b-c");
  assert.equal(slugify("--edge--"), "edge");
});

test("slugify caps length and re-trims a trailing dash from the cut", () => {
  assert.equal(slugify("x".repeat(80)).length, 60);
  // Cutting mid-string shouldn't leave a trailing dash.
  assert.ok(!slugify("ab ".repeat(40)).endsWith("-"));
});

test("slugify handles empty / non-string input", () => {
  assert.equal(slugify(""), "");
  assert.equal(slugify(null), "");
  assert.equal(slugify(undefined), "");
});

test("isValidUsername accepts 3–30 char handles, rejects bad shapes", () => {
  assert.equal(isValidUsername("ayeepat"), true);
  assert.equal(isValidUsername("zudowoodo"), true);
  assert.equal(isValidUsername("a_b-c9"), true);
  assert.equal(isValidUsername("ab"), false);          // too short
  assert.equal(isValidUsername("-lead"), false);        // leading dash
  assert.equal(isValidUsername("trail-"), false);       // trailing dash
  assert.equal(isValidUsername("Upper"), false);        // uppercase
  assert.equal(isValidUsername("has space"), false);
  assert.equal(isValidUsername("x".repeat(31)), false); // too long
  assert.equal(isValidUsername(null), false);
});

test("isValidUsername rejects reserved handles", () => {
  for (const r of ["app", "maker", "tag", "auth", "admin", "submit"]) {
    assert.equal(RESERVED_USERNAMES.has(r), true);
    assert.equal(isValidUsername(r), false);
  }
});

test("isValidSlug accepts 1–60 chars, rejects bad shapes", () => {
  assert.equal(isValidSlug("fluentcode"), true);
  assert.equal(isValidSlug("a"), true);                 // single char ok
  assert.equal(isValidSlug("my-app_2"), true);
  assert.equal(isValidSlug("-lead"), false);
  assert.equal(isValidSlug("trail-"), false);
  assert.equal(isValidSlug("Caps"), false);
  assert.equal(isValidSlug("x".repeat(61)), false);
  assert.equal(isValidSlug(""), false);
});

test("appPath builds pretty URL when username + slug present", () => {
  assert.equal(
    appPath({ id: "u1", username: "zudowoodo", slug: "notenotes" }),
    "/zudowoodo/notenotes"
  );
});

test("appPath uses the fallback username when the app row lacks one", () => {
  assert.equal(
    appPath({ id: "u1", slug: "fluentcode" }, "ayeepat"),
    "/ayeepat/fluentcode"
  );
});

test("appPath falls back to /app/:id when handle parts are missing", () => {
  assert.equal(appPath({ id: "abc-123", slug: "x" }), "/app/abc-123");
  assert.equal(appPath({ id: "abc-123", username: "u" }), "/app/abc-123");
  assert.equal(appPath({ id: "abc-123" }), "/app/abc-123");
});

test("appPath returns /gallery for a nullish app", () => {
  assert.equal(appPath(null), "/gallery");
});
