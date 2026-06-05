import test from "node:test";
import assert from "node:assert/strict";

import {
  generateVerificationToken,
  buildVerificationHtml,
  getVerificationInstructions,
} from "../src/lib/verifyTokens.js";
import { isVerificationTokenSafe } from "../supabase/functions/_shared/verifyToken.ts";

// --- Token generation -------------------------------------------------------

test("generateVerificationToken has the expected shape", () => {
  const t = generateVerificationToken();
  // vg-verify- + 32 hex chars (16 random bytes).
  assert.match(t, /^vg-verify-[0-9a-f]{32}$/);
});

test("generateVerificationToken is unique across calls", () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(generateVerificationToken());
  assert.equal(seen.size, 500);
});

test("a freshly generated token is accepted by the server-side validator", () => {
  for (let i = 0; i < 50; i++) {
    assert.equal(isVerificationTokenSafe(generateVerificationToken()), true);
  }
});

// --- Verification file builder ---------------------------------------------

test("buildVerificationHtml embeds the token in meta + body", () => {
  const html = buildVerificationHtml("vg-verify-abc123");
  assert.ok(html.includes('content="vg-verify-abc123"'));
  assert.ok(html.includes(">vg-verify-abc123<"));
  // The server checks `body.includes(token)`, so the raw token must appear.
  assert.ok(html.includes("vg-verify-abc123"));
});

test("buildVerificationHtml escapes HTML-significant characters", () => {
  const html = buildVerificationHtml('"><script>alert(1)</script>');
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&quot;"));
});

// --- Instructions object ----------------------------------------------------

test("getVerificationInstructions strips a trailing slash from the base URL", () => {
  const out = getVerificationInstructions("https://myapp.com/", "vg-verify-xyz");
  assert.equal(out.txtFile.url, "https://myapp.com/vg-verify-xyz.txt");
  assert.equal(out.htmlFile.url, "https://myapp.com/vg-verify-xyz.html");
});

test("getVerificationInstructions tolerates a missing base URL", () => {
  const out = getVerificationInstructions(undefined, "vg-verify-xyz");
  assert.equal(out.txtFile.url, "/vg-verify-xyz.txt");
});

// --- Server-side token validator -------------------------------------------

test("isVerificationTokenSafe accepts plain tokens", () => {
  assert.equal(isVerificationTokenSafe("vg-verify-deadbeef"), true);
  assert.equal(isVerificationTokenSafe("a"), true);
  assert.equal(isVerificationTokenSafe("A1-_.~token"), true);
});

test("isVerificationTokenSafe rejects path/query/fragment escapes and whitespace", () => {
  const bad = [
    "../../etc/passwd",
    "tok/with/slash",
    "tok\\back",
    "tok?query=1",
    "tok#frag",
    "tok with space",
    "tok\twith\ttab",
    "tok\nnewline",
    "",
    "   ",
  ];
  for (const t of bad) {
    assert.equal(isVerificationTokenSafe(t), false, `expected unsafe: ${JSON.stringify(t)}`);
  }
});

test("isVerificationTokenSafe rejects non-strings and over-long tokens", () => {
  assert.equal(isVerificationTokenSafe(null), false);
  assert.equal(isVerificationTokenSafe(undefined), false);
  assert.equal(isVerificationTokenSafe(12345), false);
  assert.equal(isVerificationTokenSafe("x".repeat(129)), false);
  assert.equal(isVerificationTokenSafe("x".repeat(128)), true);
});
