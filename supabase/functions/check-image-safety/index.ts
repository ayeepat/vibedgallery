// Supabase Edge Function: check-image-safety
// Server-side image moderation. The client's checkImageSafety() validates
// MIME + dimensions before upload, but those checks run in JavaScript and
// can be bypassed by anyone willing to hit the storage API directly with
// curl. This function is the trusted backstop.
//
// Wrapped around Google Cloud Vision SafeSearch. We block on `adult` and
// `violence` at LIKELY or VERY_LIKELY (Vision's two highest tiers), which
// matches the policy a public gallery needs without false-positiving on
// edgy-but-legitimate design work.
//
// Body:    { url: string }            -- public CDN URL of the uploaded image
// Returns: { safe: boolean, classifications?: object, threats?: string[],
//            skipped?: boolean, error?: string }
//
// Fail-safe behaviour mirrors check-url-safety:
//   - GOOGLE_CLOUD_VISION_KEY missing → { safe:true, skipped:true } so a
//     server-config gap doesn't block submissions while the admin still sees
//     the row in their queue and can spot-check manually.
//   - Upstream/parse errors → { safe:false } so submission is rejected.

import { corsHeaders } from "../_shared/cors.ts";
import {
  assertPublicHttpUrl,
  resolveAndAssertPublic,
  SsrfError,
} from "../_shared/ssrfGuard.ts";

const API_KEY = Deno.env.get("GOOGLE_CLOUD_VISION_KEY");

// Vision's likelihood scale: VERY_UNLIKELY, UNLIKELY, POSSIBLE, LIKELY,
// VERY_LIKELY. Anything >= LIKELY for adult or violence is blocked.
const BLOCK_LIKELIHOODS = new Set(["LIKELY", "VERY_LIKELY"]);

interface Payload {
  url?: unknown;
}

interface SafeSearchAnnotation {
  adult?: string;
  spoof?: string;
  medical?: string;
  violence?: string;
  racy?: string;
}

interface VisionResponse {
  responses?: Array<{
    safeSearchAnnotation?: SafeSearchAnnotation;
    error?: { message?: string };
  }>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ safe: false, error: "Method not allowed" }, 405);
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ safe: false, error: "Invalid JSON body" }, 400);
  }

  const raw = typeof payload.url === "string" ? payload.url.trim() : "";
  if (!raw) {
    return json({ safe: false, error: "Missing url" }, 400);
  }

  // Defence in depth: we'll hand this URL to Google, but if anyone gets cute
  // and POSTs `http://169.254.169.254/...`, refuse before contacting upstream.
  let url: URL;
  try {
    url = assertPublicHttpUrl(raw);
    await resolveAndAssertPublic(url);
  } catch (err) {
    if (err instanceof SsrfError) {
      return json({ safe: false, error: err.message }, 400);
    }
    return json({ safe: false, error: "URL validation failed" }, 400);
  }

  // No key configured → skip rather than fail. Admin still reviews manually.
  if (!API_KEY) {
    console.warn("check-image-safety: GOOGLE_CLOUD_VISION_KEY not set");
    return json({ safe: true, skipped: true });
  }

  // Hard timeout so a slow/hung Vision API can't keep the function alive
  // indefinitely (Supabase default is generous, and we hold no useful state
  // while waiting).
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const upstream = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { source: { imageUri: url.toString() } },
              features: [{ type: "SAFE_SEARCH_DETECTION" }],
            },
          ],
        }),
        signal: controller.signal,
      },
    );

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error(
        "check-image-safety: Vision upstream failed",
        upstream.status,
        detail,
      );
      return json({
        safe: false,
        error: "Upstream image safety check failed. Try again.",
      });
    }

    const data = (await upstream.json()) as VisionResponse;
    const r = data.responses?.[0];

    if (r?.error?.message) {
      console.error("check-image-safety: Vision returned error", r.error.message);
      return json({
        safe: false,
        error: "Image safety check failed. Please try again.",
      });
    }

    const annotation = r?.safeSearchAnnotation;
    if (!annotation) {
      // Vision didn't return a SafeSearch result — fail closed.
      return json({
        safe: false,
        error: "Image could not be classified. Try a different file.",
      });
    }

    const threats: string[] = [];
    if (BLOCK_LIKELIHOODS.has(annotation.adult ?? "")) threats.push("adult");
    if (BLOCK_LIKELIHOODS.has(annotation.violence ?? "")) threats.push("violence");

    return json({
      safe: threats.length === 0,
      threats,
      classifications: annotation,
    });
  } catch (err) {
    const isAbort = (err as Error)?.name === "AbortError";
    console.error("check-image-safety error", isAbort ? "timeout" : err);
    return json({
      safe: false,
      error: isAbort
        ? "Image safety check timed out. Please try again."
        : "Image safety check failed. Please try again.",
    });
  } finally {
    clearTimeout(timeoutId);
  }
});
