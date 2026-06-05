import { useEffect, useRef, useState } from "react";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

// Minimal wrapper around Cloudflare Turnstile.
//   - Loads the widget (Cloudflare's script is in index.html).
//   - Calls `onVerify(token)` when the user completes the challenge.
//   - Calls `onExpire()` if the token expires (typically ~5 min).
//   - Calls `onError()` if the widget itself errors.
//   - Exposes a `reset()` method via the optional `innerRef` prop.
//
// If `VITE_TURNSTILE_SITE_KEY` is unset, renders a small inline note and
// auto-issues a "DEV_BYPASS" token so local dev isn't blocked.
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

  // Local-dev escape hatch: no site key = auto-pass with a sentinel token.
  // Gated on import.meta.env.DEV so a production build never silently emits
  // the bypass token even if VITE_TURNSTILE_SITE_KEY is accidentally unset.
  useEffect(() => {
    if (import.meta.env.DEV && !SITE_KEY && onVerify) onVerify("DEV_BYPASS");
  }, [onVerify]);

  // Wait for Cloudflare's script to define window.turnstile, then mount.
  useEffect(() => {
    if (!SITE_KEY) return;

    let cancelled = false;
    const tryMount = () => {
      if (cancelled) return;
      if (!window.turnstile) {
        setTimeout(tryMount, 100);
        return;
      }
      if (!containerRef.current) return;

      const id = window.turnstile.render(containerRef.current, {
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
      if (widgetIdRef.current && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current);
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
        if (widgetIdRef.current && window.turnstile?.reset) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    };
  }, [innerRef, ready]);

  if (!SITE_KEY) {
    if (!import.meta.env.DEV) {
      // Misconfigured prod build — refuse to render anything that could be
      // mistaken for a passed captcha. The submit form will keep its CTA
      // disabled because onVerify never fires.
      return (
        <p className={`text-[9px] font-bold uppercase tracking-widest text-red-600 ${className}`}>
          Captcha unavailable — please refresh or contact support.
        </p>
      );
    }
    return (
      <p className={`text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA] ${className}`}>
        Captcha disabled (no site key set) — dev mode
      </p>
    );
  }

  return <div ref={containerRef} className={className} />;
}
