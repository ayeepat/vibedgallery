import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { sanitizeRedirectPath } from "@/lib/urlHelpers";
import { Loader2 } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import GithubIcon from "@/components/GithubIcon";
import { usePageMeta } from "@/lib/usePageMeta";

export default function Login() {
  usePageMeta({
    title: "Sign In",
    description: "Sign in to VibedGallery to submit apps, save favorites, and follow other makers.",
    path: "/login",
  });

  const { login, signInWithProvider } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [oauthLoading, setOauthLoading] = useState("");

  // Show success message if coming from password reset
  const resetSuccess = searchParams.get("reset") === "success";
  // Where to send the user after a successful sign-in. ProtectedRoute sets
  // ?from=/path when it bounces an unauthenticated user here. Refuse external
  // destinations — only same-origin paths.
  const redirectTarget = sanitizeRedirectPath(searchParams.get("from"));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      if (
        err.message.includes("Invalid login") ||
        err.message.includes("invalid_credentials") ||
        err.message.includes("Invalid email or password")
      ) {
        setError("Invalid email or password.");
      } else if (err.message.includes("Email not confirmed")) {
        setError("Please verify your email before logging in.");
      } else {
        setError(err.message || "Something went wrong. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    setError("");
    setOauthLoading(provider);
    try {
      await signInWithProvider(provider, { redirectPath: redirectTarget });
      // Browser is now navigating to the provider — nothing else to do.
    } catch (err) {
      setError(err.message || `Could not start ${provider} sign in.`);
      setOauthLoading("");
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Minimal nav */}
      <div className="h-14 border-b border-[#E5E5E5] flex items-center px-6">
        <Link
          to="/"
          className="text-xs font-black uppercase tracking-widest text-black"
        >
          VibedGallery
        </Link>
      </div>

      {/* Main */}
      <div className="flex-1 flex">

        {/* Left panel — branding */}
        <div className="hidden lg:flex w-[45%] border-r border-[#E5E5E5] flex-col justify-between p-12">
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-6">
              A gallery for apps built with AI
            </p>
            <h1
              className="text-[clamp(3rem,6.5vw,6rem)] font-black uppercase leading-[0.9] text-black"
              style={{ letterSpacing: "-0.04em" }}
            >
              WELCOME<br />BACK.
            </h1>
            <p className="mt-6 text-sm text-[#717171] max-w-xs leading-relaxed">
              Sign in to submit your apps, save the ones you like, and keep up with what people are building.
            </p>
          </div>

          {/* Bottom stat strip */}
          <div className="border border-[#E5E5E5]">
            <div className="flex">
              <div className="flex-1 border-r border-[#E5E5E5] p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171]">
                  Apps Listed
                </p>
                <p className="text-2xl font-black uppercase mt-1">2,400+</p>
              </div>
              <div className="flex-1 p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171]">
                  Builders
                </p>
                <p className="text-2xl font-black uppercase mt-1">890+</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 flex flex-col justify-center px-8 py-12 max-w-md mx-auto w-full">

          {/* Header */}
          <div className="mb-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-3">
              Sign In
            </p>
            <h2
              className="text-3xl font-black uppercase leading-none"
              style={{ letterSpacing: "-0.04em" }}
            >
              YOUR<br />ACCOUNT.
            </h2>
          </div>

          {/* Reset success banner */}
          {resetSuccess && (
            <div className="mb-6 border border-black p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-black">
                Password reset successful. Sign in below.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 border border-[#E5E5E5] p-4 bg-[#F5F5F5]">
              <p className="text-[11px] font-bold uppercase tracking-widest text-black">
                {error}
              </p>
            </div>
          )}

          {/* OAuth */}
          <div className="flex flex-col border border-[#E5E5E5] mb-0">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={loading || !!oauthLoading}
              className="h-12 flex items-center justify-between px-6 bg-white text-black hover:bg-[#F5F5F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex items-center gap-3">
                <GoogleIcon className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {oauthLoading === "google" ? "Redirecting..." : "Continue with Google"}
                </span>
              </span>
              {oauthLoading === "google"
                ? <Loader2 className="w-3 h-3 animate-spin text-[#888]" />
                : <span className="text-xs text-[#717171]">→</span>}
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("github")}
              disabled={loading || !!oauthLoading}
              className="h-12 flex items-center justify-between px-6 bg-white text-black border-t border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex items-center gap-3">
                <GithubIcon className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {oauthLoading === "github" ? "Redirecting..." : "Continue with GitHub"}
                </span>
              </span>
              {oauthLoading === "github"
                ? <Loader2 className="w-3 h-3 animate-spin text-[#888]" />
                : <span className="text-xs text-[#717171]">→</span>}
            </button>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 border-t border-[#E5E5E5]" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
              Or with email
            </span>
            <div className="flex-1 border-t border-[#E5E5E5]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col border border-[#E5E5E5]">

            {/* Email field */}
            <div className="border-b border-[#E5E5E5]">
              <label className="block px-4 pt-3 text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                Email Address
              </label>
              <input
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none"
              />
            </div>

            {/* Password field */}
            <div className="border-b border-[#E5E5E5]">
              <label className="block px-4 pt-3 text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="h-14 flex items-center justify-between px-6 bg-black text-white hover:bg-[#222] transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {loading ? "Signing In..." : "Sign In"}
              </span>
              {loading
                ? <Loader2 className="w-3 h-3 animate-spin text-[#888]" />
                : <span className="text-xs text-[#888] group-hover:text-[#bbb] transition-colors">→</span>
              }
            </button>
          </form>

          {/* Forgot password */}
          <div className="mt-0 border-l border-r border-b border-[#E5E5E5]">
            <Link
              to="/forgot-password"
              className="h-10 flex items-center px-6 text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black hover:bg-[#F5F5F5] transition-colors"
            >
              Forgot your password?
            </Link>
          </div>

          {/* Register CTA */}
          <div className="mt-6 border border-[#E5E5E5]">
            <Link
              to="/register"
              className="h-14 flex items-center justify-between px-6 bg-white text-black hover:bg-[#F5F5F5] transition-colors group"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Create an Account
              </span>
              <span className="text-xs text-[#717171] group-hover:text-black transition-colors">→</span>
            </Link>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="h-12 border-t border-[#E5E5E5] flex items-center px-6 justify-between">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
          VibedGallery © 2025
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
          Apps built with AI, shared by their makers.
        </span>
      </div>

    </div>
  );
}