import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Loader2 } from "lucide-react";
import Turnstile from "@/components/Turnstile";
import { verifyTurnstile } from "@/lib/edgeFunctions";
import GoogleIcon from "@/components/GoogleIcon";
import GithubIcon from "@/components/GithubIcon";
import { usePageMeta } from "@/lib/usePageMeta";

export default function Register() {
  usePageMeta({
    title: "Create Account",
    description: "Create a VibedGallery account in under a minute — free, no credit card.",
    path: "/register",
  });

  const { register, verifyOtp, resendOtp, signInWithProvider } = useAuth();
  const navigate = useNavigate();

  // Two steps: 'register' → fill form | 'verify' → enter OTP
  const [step, setStep]           = useState("register");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [otp, setOtp]             = useState("");
  const [error, setError]         = useState("");
  const [message, setMessage]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [captchaToken, setCaptchaToken] = useState("");
  const [oauthLoading, setOauthLoading] = useState("");
  const captchaRef = useRef(null);

  const handleOAuth = async (provider) => {
    setError("");
    setOauthLoading(provider);
    try {
      await signInWithProvider(provider, { redirectPath: "/" });
    } catch (err) {
      setError(err.message || `Could not start ${provider} sign in.`);
      setOauthLoading("");
    }
  };

  // ─── Cooldown timer effect ────────────────────────────────
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // ─── Step 1: Register ──────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!captchaToken) {
      setError("Please complete the captcha.");
      return;
    }

    setLoading(true);
    try {
      const captcha = await verifyTurnstile(captchaToken, "register");
      if (!captcha.success) {
        setError("Captcha verification failed. Try again.");
        captchaRef.current?.reset();
        setCaptchaToken("");
        setLoading(false);
        return;
      }

      await register(email, password);
      setStep("verify");
      setMessage("Check your email for a 6-digit verification code.");
    } catch (err) {
      const msg = err?.message || "";

      if (
        msg.includes("already registered") ||
        msg.includes("already exists") ||
        msg.includes("User already registered")
      ) {
        setError("An account with this email already exists. Try signing in instead.");
      } else if (
        (msg.includes("after") && msg.includes("seconds")) ||
        msg.toLowerCase().includes("rate limit") ||
        msg.toLowerCase().includes("security purposes")
      ) {
        // Supabase rate-limit: a code was very likely already sent on the
        // first attempt, so move the user forward to enter it.
        setStep("verify");
        setMessage("A code was already sent. Check your email and enter it below.");
      } else if (msg.toLowerCase().includes("load failed") || msg.toLowerCase().includes("fetch")) {
        setError("Network error reaching the server. Check your connection and try again.");
      } else {
        setError(msg || "Something went wrong. Try again.");
      }
      // The captcha token is single-use; reset so the user can retry.
      captchaRef.current?.reset();
      setCaptchaToken("");
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: Verify OTP ────────────────────────────────────
  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await verifyOtp(email, otp);
      navigate("/");
    } catch (err) {
      if (
        err.message.includes("expired") ||
        err.message.includes("Token has expired")
      ) {
        setError("Code expired. Request a new one below.");
      } else {
        setError("Invalid code. Check your email and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend OTP ────────────────────────────────────────────
  const handleResend = async () => {
    setError("");
    setMessage("");
    setResending(true);

    try {
      await resendOtp(email);
      setMessage("New code sent. Check your email.");
      setResendCooldown(60);
    } catch (err) {
      setError(err.message || "Failed to resend. Try again.");
    } finally {
      setResending(false);
    }
  };

  // ─── Verify step UI ────────────────────────────────────────
  if (step === "verify") {
    return (
      <div className="min-h-screen bg-white flex flex-col">

        <div className="h-14 border-b border-[#E5E5E5] flex items-center px-6">
          <Link
            to="/"
            className="text-xs font-black uppercase tracking-widest text-black"
          >
            VibedGallery
          </Link>
        </div>

        <div className="flex-1 flex flex-col justify-center px-8 py-12 max-w-md mx-auto w-full">

          {/* Header */}
          <div className="mb-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-3">
              Step 2 of 2 — Verify Email
            </p>
            <h2
              className="text-3xl font-black uppercase leading-none"
              style={{ letterSpacing: "-0.04em" }}
            >
              CHECK<br />YOUR<br />INBOX.
            </h2>
            <p className="mt-4 text-xs text-[#717171] leading-relaxed">
              We sent a 6-digit code to{" "}
              <span className="font-bold text-black">{email}</span>
            </p>
          </div>

          {/* Message */}
          {message && (
            <div className="mb-6 border border-[#E5E5E5] p-4 bg-[#F5F5F5]">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#717171]">
                {message}
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

          {/* OTP Form */}
          <form onSubmit={handleVerify} className="flex flex-col border border-[#E5E5E5]">
            <div className="border-b border-[#E5E5E5]">
              <label className="block px-4 pt-3 text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                required
                className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none tracking-[0.5em] font-bold"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="h-14 flex items-center justify-between px-6 bg-black text-white hover:bg-[#222] transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {loading ? "Verifying..." : "Verify & Enter"}
              </span>
              {loading
                ? <Loader2 className="w-3 h-3 animate-spin text-[#888]" />
                : <span className="text-xs text-[#888] group-hover:text-[#bbb] transition-colors">→</span>
              }
            </button>
          </form>

          {/* Resend */}
          <div className="mt-0 border-l border-r border-b border-[#E5E5E5]">
            <button
              onClick={handleResend}
              disabled={resending || resendCooldown > 0}
              className="h-10 w-full flex items-center justify-between px-6 text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black hover:bg-[#F5F5F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>
                {resending ? "Sending..." : resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : "Resend Code"}
              </span>
            </button>
          </div>

          {/* Change Email Button */}
          <button
            onClick={() => { 
              setStep("register"); 
              setError(""); 
              setMessage("");
              setOtp("");
              setResendCooldown(0);
              setEmail("");
              setPassword("");
              setConfirm("");
            }}
            className="mt-4 h-10 border border-[#E5E5E5] rounded flex items-center justify-center px-6 text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black hover:bg-[#F5F5F5] transition-colors"
          >
            Change Email
          </button>

          {/* Already confirmed via email link */}
          <Link
            to="/login"
            className="mt-8 text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black transition-colors text-left"
          >
            Confirmed via email link? Sign in →
          </Link>

        </div>

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

  // ─── Register step UI ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col">

      <div className="h-14 border-b border-[#E5E5E5] flex items-center px-6">
        <Link
          to="/"
          className="text-xs font-black uppercase tracking-widest text-black"
        >
          VibedGallery
        </Link>
      </div>

      <div className="flex-1 flex">

        {/* Left panel */}
        <div className="hidden lg:flex w-[45%] border-r border-[#E5E5E5] flex-col justify-between p-12">
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-6">
              A gallery for apps built with AI
            </p>
            <h1
              className="text-[clamp(2.5rem,4vw,4.5rem)] font-black uppercase leading-[0.9] text-black"
              style={{ letterSpacing: "-0.04em" }}
            >
              CREATE AN<br />ACCOUNT.
            </h1>
            <p className="mt-6 text-sm text-[#717171] max-w-xs leading-relaxed">
              Sign up to submit your apps, follow other builders, and save the ones you like.
            </p>
          </div>

          <div className="border border-[#E5E5E5]">
            <div className="flex">
              <div className="flex-1 border-r border-[#E5E5E5] p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171]">
                  Free Forever
                </p>
                <p className="text-2xl font-black uppercase mt-1">$0</p>
              </div>
              <div className="flex-1 p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171]">
                  Setup Time
                </p>
                <p className="text-2xl font-black uppercase mt-1">60s</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 flex flex-col justify-center px-8 py-12 max-w-md mx-auto w-full">

          <div className="mb-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-3">
              Step 1 of 2 — Create Account
            </p>
            <h2
              className="text-3xl font-black uppercase leading-none"
              style={{ letterSpacing: "-0.04em" }}
            >
              NEW<br />MEMBER.
            </h2>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 border border-[#E5E5E5] p-4 bg-[#F5F5F5]">
              <p className="text-[11px] font-bold uppercase tracking-widest text-black">
                {error}
              </p>
            </div>
          )}

          {/* OAuth */}
          <div className="flex flex-col border border-[#E5E5E5] mb-6">
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
          <div className="mb-6 flex items-center gap-4">
            <div className="flex-1 border-t border-[#E5E5E5]" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
              Or with email
            </span>
            <div className="flex-1 border-t border-[#E5E5E5]" />
          </div>

          <form onSubmit={handleRegister} className="flex flex-col border border-[#E5E5E5]">

            {/* Email */}
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

            {/* Password */}
            <div className="border-b border-[#E5E5E5]">
              <label className="block px-4 pt-3 text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none"
              />
            </div>

            {/* Confirm Password */}
            <div className="border-b border-[#E5E5E5]">
              <label className="block px-4 pt-3 text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                Confirm Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none"
              />
            </div>

            {/* Captcha */}
            <div className="px-4 py-4 border-t border-[#E5E5E5] flex items-center justify-center">
              <Turnstile
                action="register"
                innerRef={captchaRef}
                onVerify={(t) => setCaptchaToken(t)}
                onExpire={() => setCaptchaToken("")}
                onError={() => setCaptchaToken("")}
              />
            </div>

            {/* Submit — kept clickable; the captcha is validated on submit
                (see handleRegister) so the button is never a dead end. */}
            <button
              type="submit"
              disabled={loading}
              className="h-14 flex items-center justify-between px-6 bg-black text-white hover:bg-[#222] transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {loading ? "Creating Account..." : "Continue →"}
              </span>
              {loading && <Loader2 className="w-3 h-3 animate-spin text-[#888]" />}
            </button>

          </form>

          {/* Password hint */}
          <p className="mt-3 text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA]">
            Min. 8 characters with letters and numbers.
          </p>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 border-t border-[#E5E5E5]" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">Or</span>
            <div className="flex-1 border-t border-[#E5E5E5]" />
          </div>

          {/* Login CTA */}
          <div className="border border-[#E5E5E5]">
            <Link
              to="/login"
              className="h-14 flex items-center justify-between px-6 bg-white text-black hover:bg-[#F5F5F5] transition-colors group"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Already have an account? Sign In
              </span>
              <span className="text-xs text-[#717171] group-hover:text-black transition-colors">→</span>
            </Link>
          </div>

        </div>
      </div>

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