import test from "node:test";
import assert from "node:assert/strict";

import { formatSubmitError } from "../src/lib/submitErrors.js";
import {
  validateImageConstraints,
  MAX_IMAGE_BYTES,
} from "../src/lib/imageConstraints.js";

// --- Error formatting -------------------------------------------------------

test("formatSubmitError hides the server rate-limit policy text", () => {
  const out = formatSubmitError("rate limit: 5 per hour exceeded");
  assert.ok(!/5 per hour/i.test(out));
  assert.match(out, /too quickly/i);
});

test("formatSubmitError matches rate-limit case-insensitively", () => {
  assert.match(formatSubmitError("RATE LIMIT hit"), /too quickly/i);
});

test("formatSubmitError passes through other messages", () => {
  assert.equal(formatSubmitError("URL is already listed"), "URL is already listed");
});

test("formatSubmitError falls back to a generic line for empty/invalid input", () => {
  assert.match(formatSubmitError(""), /something went wrong/i);
  assert.match(formatSubmitError(undefined), /something went wrong/i);
  assert.match(formatSubmitError(null), /something went wrong/i);
});

// --- Image constraints ------------------------------------------------------

const okType = "image/png";

test("validateImageConstraints accepts a valid image", () => {
  const errors = validateImageConstraints({
    type: okType,
    size: 1024,
    width: 1280,
    height: 720,
  });
  assert.deepEqual(errors, []);
});

test("validateImageConstraints rejects disallowed MIME types", () => {
  const errors = validateImageConstraints({ type: "image/svg+xml", size: 10 });
  assert.ok(errors.some((e) => /JPG, PNG, WebP or GIF/.test(e)));
});

test("validateImageConstraints rejects oversized files", () => {
  const errors = validateImageConstraints({
    type: okType,
    size: MAX_IMAGE_BYTES + 1,
  });
  assert.ok(errors.some((e) => /under 5MB/.test(e)));
});

test("validateImageConstraints rejects too-small dimensions", () => {
  const errors = validateImageConstraints({
    type: okType,
    size: 10,
    width: 100,
    height: 50,
  });
  assert.ok(errors.some((e) => /at least 200x100/.test(e)));
});

test("validateImageConstraints rejects too-large dimensions", () => {
  const errors = validateImageConstraints({
    type: okType,
    size: 10,
    width: 7000,
    height: 7000,
  });
  assert.ok(errors.some((e) => /Max 6000x6000/.test(e)));
});

test("validateImageConstraints skips dimension checks when not provided", () => {
  // Cheap pre-check before decoding the image: type + size only.
  const errors = validateImageConstraints({ type: okType, size: 10 });
  assert.deepEqual(errors, []);
});
