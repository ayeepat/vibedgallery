// Shared validation for ownership-verification tokens. Used by the verify-html
// Edge Function to reject anything that could escape the URL path segment it's
// interpolated into (`${base}/${token}.html`). Kept in _shared so it can be
// unit-tested directly (see tests/verify.test.js).

const MAX_TOKEN_LENGTH = 128;
// Reject path separators, query/fragment delimiters, and any whitespace.
const UNSAFE_TOKEN_CHARS = /[/\\?#\s]/;

export function isVerificationTokenSafe(token: unknown): boolean {
  if (typeof token !== "string") return false;
  const t = token.trim();
  if (t.length === 0 || t.length > MAX_TOKEN_LENGTH) return false;
  if (UNSAFE_TOKEN_CHARS.test(t)) return false;
  return true;
}
