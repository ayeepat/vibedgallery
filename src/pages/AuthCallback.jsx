import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { sanitizeRedirectPath } from "@/lib/urlHelpers";

// Lands here after an OAuth provider redirects back. The Supabase client is
// configured with detectSessionInUrl + PKCE, so AuthProvider's own getSession()
// awaits that exchange before resolving. We read the SHARED auth state here
// rather than calling getSession() again: a second getSession() contends for
// the same cross-tab Web Lock and resolves on its own React state, which can
// race ahead of AuthProvider's — so we'd navigate into a protected route before
// ProtectedRoute can see the session and it would bounce us back to /login.
// Firefox's lock/event-loop timing lost that race; Chrome usually won it.
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, authChecked } = useAuth();
  const [error, setError] = useState("");

  // Surface provider-side errors (?error=access_denied&error_description=...).
  const providerError =
    searchParams.get("error_description") || searchParams.get("error");

  // Resolve the stashed "next" path once, before it's cleared.
  const nextRef = useRef(null);
  if (nextRef.current === null) {
    let next = "/";
    try {
      next = sanitizeRedirectPath(sessionStorage.getItem("postAuthRedirect"));
      sessionStorage.removeItem("postAuthRedirect");
    } catch {
      // sessionStorage can be unavailable in private mode — default to "/".
    }
    nextRef.current = next;
  }

  useEffect(() => {
    if (providerError) {
      setError(providerError);
      return;
    }
    // Wait for AuthProvider to finish its session check (which includes the
    // PKCE exchange) before deciding anything.
    if (!authChecked) return;
    if (isAuthenticated) {
      navigate(nextRef.current, { replace: true });
      return;
    }
    // Checked, but no session. The exchange can occasionally land via the
    // SIGNED_IN event a beat after the first check, so give it a short grace
    // window; if it never arrives, surface a real error instead of a silent
    // dead-end. This commonly means the browser blocked storage for this site
    // (Firefox strict tracking protection / private mode).
    const t = setTimeout(() => {
      setError(
        "Could not complete sign in. If your browser is blocking storage " +
        "for this site (e.g. Firefox strict tracking protection or a private " +
        "window), allow it and try again."
      );
    }, 4000);
    return () => clearTimeout(t);
  }, [authChecked, isAuthenticated, providerError, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-3">
          Sign In
        </p>
        <h1
          className="text-3xl font-black uppercase leading-none text-black"
          style={{ letterSpacing: "-0.04em" }}
        >
          SOMETHING<br />WENT WRONG.
        </h1>
        <p className="mt-4 text-xs text-[#717171] max-w-sm leading-relaxed">
          {error}
        </p>
        <Link
          to="/login"
          className="mt-8 h-12 px-6 flex items-center bg-black text-white hover:bg-[#222] transition-colors"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Back to Sign In
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-[#717171]" />
    </div>
  );
}
