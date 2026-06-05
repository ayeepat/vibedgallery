import test from "node:test";
import assert from "node:assert/strict";

import {
  toggleUpvoteCount,
  rollbackUpvoteCount,
  nextUpvoted,
} from "../src/lib/upvote.js";

test("toggleUpvoteCount adds when not yet upvoted", () => {
  assert.equal(toggleUpvoteCount(0, false), 1);
  assert.equal(toggleUpvoteCount(41, false), 42);
});

test("toggleUpvoteCount removes when already upvoted", () => {
  assert.equal(toggleUpvoteCount(42, true), 41);
  assert.equal(toggleUpvoteCount(1, true), 0);
});

test("toggleUpvoteCount never goes below zero", () => {
  assert.equal(toggleUpvoteCount(0, true), 0);
  assert.equal(toggleUpvoteCount(-5, true), 0);
});

test("toggleUpvoteCount tolerates a missing/NaN initial count", () => {
  // app.upvotes can be undefined before the row fully resolves.
  assert.equal(toggleUpvoteCount(undefined, false), 1);
  assert.equal(toggleUpvoteCount(NaN, false), 1);
  assert.equal(toggleUpvoteCount(undefined, true), 0);
});

test("rollbackUpvoteCount is the exact inverse of a toggle (valid states)", () => {
  // Only realistic states: if the user had already upvoted (was=true) the count
  // is at least 1 — you can't have upvoted something showing 0 upvotes. The
  // 0/true combination is contradictory and never produced by the component.
  const cases = [
    [0, false],
    [1, false],
    [7, false],
    [100, false],
    [1, true],
    [7, true],
    [100, true],
  ];
  for (const [start, was] of cases) {
    const toggled = toggleUpvoteCount(start, was);
    // After the server rejects, rolling back from the toggled value with the
    // same `wasUpvoted` returns to the original count.
    assert.equal(rollbackUpvoteCount(toggled, was), start, `start=${start} was=${was}`);
  }
});

test("rollbackUpvoteCount clamps at zero", () => {
  assert.equal(rollbackUpvoteCount(0, false), 0);
});

test("nextUpvoted flips the flag", () => {
  assert.equal(nextUpvoted(false), true);
  assert.equal(nextUpvoted(true), false);
});
