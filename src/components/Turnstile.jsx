import { useEffect, useRef, useState } from "react";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

// Cloudflare's script attaches `turnstile` to window — not in lib.dom types.
const getTurnstile = () => /** @type {any} */ (window).turnstile;

// Sentinel emitted when no site key is configured. It is NOT a bypass: the
// server (verify-turnstile) only skips verification when its own
// TURNSTILE_SECRET_KEY is also unset. If the secret IS configured, the server
// hands this string to Cloudflare, which rejects it — so an unset/forgotten
// client key can never bypass a captcha the operator actually enabled.
export const UNCONFIGURED_CAPTCHA_TOKEN = "unconfigured-captcha";

// Minimal wrapper around Cloudflare Turnstile.
//   - Loads the widget (Cloudflare's script is in index.html).
//   - Calls `onVerify(token)` when the user completes the challenge.
//   - Calls `onExpire()` if the token expires (typically ~5 min).
//   - Calls `onError()` if the widget itself errors.
//   - Exposes a `reset()` method via the optional `innerRef` prop.
//
// If `VITE_TURNSTILE_SITE_KEY` is unset, the widget can't render, so we emit
// the sentinel token (so the form isn't dead) and let the server decide whether
// to enforce — matching how check-image-safety / check-url-safety skip when
// their key is unconfigured.
export default function Turnstile({
  onVerify,
  onExpire,
  onError,
  action,
  theme = "light",
  innerRef,
  className = "",
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [ready, setReady] = useState(false);

  // No site key configured → emit the sentinel so the form isn't dead. Safe in
  // prod because the server only skips when ITS secret is also unset (see the
  // UNCONFIGURED_CAPTCHA_TOKEN note above).
  useEffect(() => {
    if (!SITE_KEY && onVerify) onVerify(UNCONFIGURED_CAPTCHA_TOKEN);
  }, [onVerify]);

  // Wait for Cloudflare's script to define window.turnstile, then mount.
  useEffect(() => {
    if (!SITE_KEY) return;

    let cancelled = false;
    const tryMount = () => {
      if (cancelled) return;
      if (!getTurnstile()) {
        setTimeout(tryMount, 100);
        return;
      }
      if (!containerRef.current) return;

      const id = getTurnstile().render(containerRef.current, {
        sitekey: SITE_KEY,
        action,
        theme,
        callback: (token) => onVerify?.(token),
        "expired-callback": () => onExpire?.(),
        "error-callback": () => onError?.(),
      });
      widgetIdRef.current = id;
      setReady(true);
    };

    tryMount();

    return () => {
      cancelled = true;
      if (widgetIdRef.current && getTurnstile()?.remove) {
        try {
          getTurnstile().remove(widgetIdRef.current);
        } catch {
          // widget may already be gone
        }
        widgetIdRef.current = null;
      }
    };
    // We intentionally don't include callbacks in deps — they'd cause the
    // widget to re-render every time the parent rerenders.
     
  }, [action, theme]);

  // Expose reset via the imperative innerRef.
  useEffect(() => {
    if (!innerRef) return;
    innerRef.current = {
      reset: () => {
        if (widgetIdRef.current && getTurnstile()?.reset) {
          getTurnstile().reset(widgetIdRef.current);
        }
      },
    };
  }, [innerRef, ready]);

  if (!SITE_KEY) {
    // Captcha not configured. The sentinel token has already been emitted; the
    // server decides enforcement. Show a quiet note in dev, nothing in prod.
    if (import.meta.env.DEV) {
      return (
        <p className={`text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA] ${className}`}>
          Captcha disabled (no site key set) — dev mode
        </p>
      );
    }
    return null;
  }

  return <div ref={containerRef} className={className} />;
}
