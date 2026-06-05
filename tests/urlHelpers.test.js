import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeUrl,
  sanitizeRedirectPath,
  sanitizeSearchTerm,
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
