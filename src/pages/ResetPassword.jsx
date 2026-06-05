import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Loader2 } from "lucide-react";

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [ready, setReady]       = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);

  useEffect(() => {
    // Supabase puts the token in the URL hash after redirect
    // detectSessionInUrl: true in supabaseClient.js processes it
    // We just wait a moment for it to be consumed
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);

    const hasToken =
      hash.includes("access_token") ||
      hash.includes("type=recovery") ||
      params.get("token");

    if (!hasToken) {
      // Give supabase a moment to detect from URL before giving up
      const timer = setTimeout(() => {
        setTokenMissing(true);
        setReady(true);
      }, 1000);
      return () => clearTimeout(timer);
    }

    // Token found, give supabase time to process it
    const timer = setTimeout(() => setReady(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
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

    setLoading(true);
    try {
      await resetPassword(password);
      navigate("/login?reset=success");
    } catch (err) {
      if (err.message.includes("expired") || err.message.includes("invalid")) {
        setError("Reset link has expired. Please request a new one.");
      } else {
        setError(err.message || "Something went wrong. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Nav */}
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
              Account Security
            </p>
            <h1
              className="text-[clamp(3rem,6.5vw,6rem)] font-black uppercase leading-[0.9] text-black"
              style={{ letterSpacing: "-0.04em" }}
            >
              NEW<br />PASSWORD.
            </h1>
            <p className="mt-6 text-sm text-[#717171] max-w-xs leading-relaxed">
              Choose a strong password. Minimum 8 characters
              with a mix of letters and numbers.
            </p>
          </div>

          <div className="border border-[#E5E5E5] p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-1">
              Security Tip
            </p>
            <p className="text-xs text-[#717171] leading-relaxed">
              Never reuse passwords across different services.
              Use a password manager for best results.
            </p>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col justify-center px-8 py-12 max-w-md mx-auto w-full">

          {!ready ? (
            /* Loading state while supabase processes token */
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-6 h-6 animate-spin text-[#717171]" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171]">
                Verifying reset link...
              </p>
            </div>

          ) : tokenMissing ? (
            /* Invalid or missing token */
            <div>
              <div className="mb-8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-3">
                  Link Invalid
                </p>
                <h2
                  className="text-3xl font-black uppercase leading-none"
                  style={{ letterSpacing: "-0.04em" }}
                >
                  LINK<br />EXPIRED.
                </h2>
                <p className="mt-4 text-xs text-[#717171] leading-relaxed">
                  This reset link is invalid or has expired.
                  Reset links are valid for 24 hours.
                </p>
              </div>

              <div className="border border-[#E5E5E5]">
                <Link
                  to="/forgot-password"
                  className="h-14 flex items-center justify-between px-6 bg-black text-white hover:bg-[#222] transition-colors group"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Request New Link
                  </span>
                  <span className="text-xs text-[#888] group-hover:text-[#bbb] transition-colors">→</span>
                </Link>
              </div>

              <div className="mt-0 border-l border-r border-b border-[#E5E5E5]">
                <Link
                  to="/login"
                  className="h-10 flex items-center px-6 text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black hover:bg-[#F5F5F5] transition-colors"
                >
                  ← Back to Sign In
                </Link>
              </div>
            </div>

          ) : (
            /* Main reset form */
            <div>
              <div className="mb-8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-3">
                  Set New Password
                </p>
                <h2
                  className="text-3xl font-black uppercase leading-none"
                  style={{ letterSpacing: "-0.04em" }}
                >
                  RESET<br />ACCESS.
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

              <form onSubmit={handleSubmit} className="flex flex-col border border-[#E5E5E5]">

                {/* New password */}
                <div className="border-b border-[#E5E5E5]">
                  <label className="block px-4 pt-3 text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                    New Password
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none"
                  />
                </div>

                {/* Confirm password */}
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

                {/* Strength indicator */}
                {password.length > 0 && (
                  <div className="px-4 py-2 border-b border-[#E5E5E5] flex items-center gap-3">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 transition-colors ${
                            password.length >= level * 2 + 4
                              ? level <= 2 ? "bg-black" : "bg-black"
                              : "bg-[#E5E5E5]"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                      {password.length < 8
                        ? "Weak"
                        : password.length < 12
                        ? "Good"
                        : "Strong"}
                    </span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="h-14 flex items-center justify-between px-6 bg-black text-white hover:bg-[#222] transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {loading ? "Resetting..." : "Reset Password"}
                  </span>
                  {loading
                    ? <Loader2 className="w-3 h-3 animate-spin text-[#888]" />
                    : <span className="text-xs text-[#888] group-hover:text-[#bbb] transition-colors">→</span>
                  }
                </button>

              </form>

              <p className="mt-3 text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA]">
                Min. 8 characters with letters and numbers.
              </p>

              <div className="mt-4 border border-[#E5E5E5]">
                <Link
                  to="/login"
                  className="h-10 flex items-center px-6 text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black hover:bg-[#F5F5F5] transition-colors"
                >
                  ← Back to Sign In
                </Link>
              </div>
            </div>
          )}

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