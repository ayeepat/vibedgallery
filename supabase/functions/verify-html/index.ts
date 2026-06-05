// Supabase Edge Function: verify-html
// Server-side verification that the ownership file actually exists at the app's
// URL and contains the expected token. Runs server-side so it is NOT blocked by
// browser CORS (unlike the client-side checkOwnershipFile helper).
//
// Body: { url: string, token: string }
// Returns: { verified: boolean, method?: "html" | "txt", reason?: string }
//
// SECURITY: this function fetches a URL the caller supplies, which is a classic
// SSRF sink. Mitigations:
//   - verify_jwt=true (config.toml) AND we additionally require a real
//     authenticated user (role=authenticated), so the public anon key alone
//     cannot drive it.
//   - Every target — and every redirect hop — is validated by ssrfGuard so it
//     can only ever reach public http(s) endpoints on standard ports. Redirects
//     are followed manually (max 3) and each Location is re-validated.
//   - Response bodies are read with a hard byte cap.

import { corsHeaders } from "../_shared/cors.ts";
import {
  assertPublicHttpUrl,
  resolveAndAssertPublic,
  SsrfError,
} from "../_shared/ssrfGuard.ts";
import { isVerificationTokenSafe } from "../_shared/verifyToken.ts";

interface Payload {
  url?: unknown;
  token?: unknown;
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_BYTES = 512 * 1024; // verification files are tiny; cap to 512KB.

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, "");
}

// Decode (without verifying — the platform already verified the signature via
// verify_jwt) the bearer token's payload to read the `role` claim.
function bearerRole(req: Request): string | null {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "="));
    return JSON.parse(json)?.role ?? null;
  } catch {
    return null;
  }
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // already closed
    }
  }
  const buf = new Uint8Array(Math.min(total, MAX_BYTES));
  let off = 0;
  for (const c of chunks) {
    if (off >= buf.length) break;
    buf.set(c.subarray(0, buf.length - off), off);
    off += c.length;
  }
  return new TextDecoder().decode(buf);
}

// Fetch a target, validating the URL and every redirect hop against the SSRF
// guard. Returns the body text (capped) or null on any failure.
async function safeFetch(target: string): Promise<string | null> {
  let current = target;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let url: URL;
    try {
      url = assertPublicHttpUrl(current);
      await resolveAndAssertPublic(url);
    } catch (e) {
      if (e instanceof SsrfError) return null;
      throw e;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "VibedGallery-Verifier/1.0", Accept: "text/html,text/plain" },
      });
    } catch {
      clearTimeout(timer);
      return null;
    }
    clearTimeout(timer);

    // Follow redirects manually so each hop is re-validated.
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      try {
        await res.body?.cancel();
      } catch { /* noop */ }
      if (!loc) return null;
      current = new URL(loc, url).toString();
      continue;
    }

    if (!res.ok) {
      try {
        await res.body?.cancel();
      } catch { /* noop */ }
      return null;
    }
    return await readCapped(res);
  }
  return null; // too many redirects
}

async function tokenPresent(target: string, token: string): Promise<boolean> {
  const body = await safeFetch(target);
  return body != null && body.includes(token);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ verified: false, reason: "Method not allowed" }, 405);
  }

  // Require a real signed-in user, not just the public anon key.
  if (bearerRole(req) !== "authenticated") {
    return json({ verified: false, reason: "Authentication required" }, 401);
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return json({ verified: false, reason: "Invalid JSON body" }, 400);
  }

  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  const token = typeof payload.token === "string" ? payload.token.trim() : "";

  if (!url || !token) {
    return json({ verified: false, reason: "url and token are required" }, 400);
  }
  // Bound the token and reject anything that could escape the path segment.
  if (!isVerificationTokenSafe(token)) {
    return json({ verified: false, reason: "Invalid token" }, 400);
  }

  // Validate the base URL up front so we return a clean error for bad input.
  let base: string;
  try {
    base = stripTrailingSlash(assertPublicHttpUrl(url).toString());
  } catch (e) {
    if (e instanceof SsrfError) {
      return json({ verified: false, reason: `Disallowed URL: ${e.message}` }, 400);
    }
    return json({ verified: false, reason: "Invalid URL" }, 400);
  }

  const htmlUrl = `${base}/${token}.html`;
  const txtUrl = `${base}/${token}.txt`;

  try {
    if (await tokenPresent(htmlUrl, token)) {
      return json({ verified: true, method: "html" });
    }
    if (await tokenPresent(txtUrl, token)) {
      return json({ verified: true, method: "txt" });
    }
    return json({
      verified: false,
      reason: "Verification file not found or token mismatch",
      checked: [htmlUrl, txtUrl],
    });
  } catch (err) {
    console.error("verify-html error", err);
    return json({ verified: false, reason: "Verification check failed" }, 500);
  }
});
