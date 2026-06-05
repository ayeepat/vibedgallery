import test from "node:test";
import assert from "node:assert/strict";

import { normalizeUrl, sanitizeRedirectPath } from "../src/lib/urlHelpers.js";

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
