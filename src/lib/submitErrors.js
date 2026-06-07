// Pure mapping of raw submit/insert errors to clean, user-facing copy. Kept
// dependency-free so it can be unit-tested in isolation.
//
// The key rule: never echo the server-side rate-limit policy text (e.g.
// "rate limit: 5 per hour") back to the user — that leaks internal config.

const GENERIC = "Something went wrong. Please try again.";
const RATE_LIMITED =
  "You're submitting too quickly. Please wait a few minutes and try again.";
const TAKEN =
  "That username or app link is already taken. Pick another and try again.";

export function formatSubmitError(rawMessage) {
  const raw = typeof rawMessage === "string" ? rawMessage : "";
  if (/rate limit/i.test(raw)) return RATE_LIMITED;
  // Never echo raw Postgres unique-violation text (e.g. "duplicate key value
  // violates unique constraint profiles_username_lower_key") back to the user.
  if (/duplicate key|unique constraint|already exists/i.test(raw)) return TAKEN;
  return raw || GENERIC;
}
