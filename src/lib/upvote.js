// Pure helpers for the optimistic-upvote math in AppDetail's UpvoteButton.
// Kept dependency-free so the toggle/rollback logic can be unit-tested without
// mounting React or touching Supabase.

// Clamp a count to a non-negative integer. Guards against an undefined/NaN
// initial count (e.g. a row where `upvotes` was never set) and against a
// double-decrement racing below zero.
function clampCount(n) {
  const v = Math.trunc(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

// The new count after the user toggles their upvote.
//   wasUpvoted=true  → they're removing an upvote  → count - 1 (min 0)
//   wasUpvoted=false → they're adding an upvote     → count + 1
export function toggleUpvoteCount(count, wasUpvoted) {
  const c = clampCount(count);
  return wasUpvoted ? Math.max(c - 1, 0) : c + 1;
}

// The count to restore when the server rejects the optimistic toggle. It is the
// exact inverse of toggleUpvoteCount, so applying one then the other returns to
// the original (clamped) value.
export function rollbackUpvoteCount(count, wasUpvoted) {
  const c = clampCount(count);
  return wasUpvoted ? c + 1 : Math.max(c - 1, 0);
}

// The next "did the current user upvote this" flag.
export function nextUpvoted(wasUpvoted) {
  return !wasUpvoted;
}
