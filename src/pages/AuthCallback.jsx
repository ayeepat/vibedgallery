import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { sanitizeRedirectPath } from "@/lib/urlHelpers";

// Lands here after an OAuth provider redirects back. The Supabase client is
// configured with detectSessionInUrl + PKCE, so by the time this mounts it
// has already exchanged the ?code= param for a session. We wait for that
// session and forward the user to the path stashed in sessionStorage.
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  // Surface provider-side errors (?error=access_denied&error_description=...).
  const providerError =
    searchParams.get("error_description") || searchParams.get("error");

  useEffect(() => {
    if (providerError) {
      setError(providerError);
      return;
    }

    // Pull the stashed "next" path; fall back to root.
    let next = "/";
    try {
      next = sanitizeRedirectPath(sessionStorage.getItem("postAuthRedirect"));
      sessionStorage.removeItem("postAuthRedirect");
    } catch {
      // sessionStorage might be unavailable in private mode — just use "/".
    }

    let cancelled = false;
    let subscription;
    let timeout;

    const finish = (session) => {
      if (cancelled) return;
      if (session) {
        navigate(next, { replace: true });
      } else {
        setError("Could not complete sign in. Please try again.");
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        finish(session);
        return;
      }
      // The SDK might still be mid-exchange — wait for SIGNED_IN.
      const sub = supabase.auth.onAuthStateChange((_event, sess) => {
        if (sess) finish(sess);
      });
      subscription = sub.data.subscription;
      timeout = setTimeout(() => {
        if (cancelled) return;
        setError("Sign in timed out. Please try again.");
      }, 10000);
    });

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      subscription?.unsubscribe?.();
    };
  }, [navigate, providerError]);

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
