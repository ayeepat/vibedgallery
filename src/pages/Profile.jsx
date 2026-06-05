import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { APP_SELECT_COLUMNS } from "@/lib/useApps";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import { SubmissionCardSkeleton } from "@/components/Skeleton";
import { usePageMeta } from "@/lib/usePageMeta";
import {
  Loader2,
  Download,
  LogOut,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";

const metaVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.05 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  }),
};

const STATUS_CONFIG = {
  pending_verification: {
    label: "Pending Verification",
    accent: "text-[#717171]",
  },
  pending_review: {
    label: "Pending Review",
    accent: "text-black",
  },
  approved: {
    label: "Approved",
    accent: "text-black",
  },
  rejected: {
    label: "Rejected",
    accent: "text-black",
  },
};

function SubmissionCard({ app, onAction, loading }) {
  const config = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending_verification;

  return (
    <div className="border border-[#E5E5E5] flex flex-col">
      {/* Thumbnail */}
      <div className="relative w-full aspect-video overflow-hidden bg-[#F0F0F0] border-b border-[#E5E5E5]">
        {app.thumbnail_url ? (
          <img
            src={app.thumbnail_url}
            alt={app.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA]">
              No Thumbnail
            </span>
          </div>
        )}
        <span className={`absolute top-2 left-2 text-[9px] font-bold uppercase tracking-widest bg-white border border-[#E5E5E5] px-2 py-1 ${config.accent}`}>
          {config.label}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1">
        <div className="px-4 py-3 border-b border-[#E5E5E5]">
          <h3 className="text-sm font-black uppercase tracking-tight text-black leading-snug line-clamp-2">
            {app.title}
          </h3>
          <p className="text-[10px] text-[#AAAAAA] mt-1">
            Submitted {new Date(app.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Status detail */}
        {app.status === "pending_verification" && (
          <>
            <p className="px-4 py-3 text-[10px] text-[#717171] border-b border-[#E5E5E5]">
              Add the verification HTML file to your site.
            </p>
            <button
              onClick={() => onAction("download", app)}
              disabled={loading === app.id}
              className="h-10 px-4 flex items-center justify-between bg-white text-black hover:bg-[#F5F5F5] transition-colors disabled:opacity-50"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {loading === app.id ? "Downloading..." : "Download File"}
              </span>
              {loading === app.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
            </button>
          </>
        )}

        {app.status === "pending_review" && (
          <div className="px-4 py-3 flex-1">
            <p className="text-[10px] text-[#717171] leading-relaxed">
              HTML file confirmed. Under review by our team.
            </p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA] mt-2">
              Est. 24 Hours
            </p>
          </div>
        )}

        {app.status === "approved" && (
          <button
            onClick={() => onAction("view", app)}
            className="h-10 px-4 flex items-center justify-between bg-black text-white hover:bg-[#222] transition-colors"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest">
              View in Gallery
            </span>
            <span className="text-xs text-[#888]">→</span>
          </button>
        )}

        {app.status === "rejected" && (
          <>
            <div className="px-4 py-3 border-b border-[#E5E5E5]">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                Rejection Reason
              </p>
              <p className="text-[11px] text-black mt-1 leading-relaxed">
                {app.rejection_reason || "No reason provided."}
              </p>
            </div>
            <button
              onClick={() => onAction("resubmit", app)}
              disabled={loading === app.id}
              className="h-10 px-4 flex items-center justify-between bg-black text-white hover:bg-[#222] transition-colors disabled:opacity-50"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {loading === app.id ? "Loading..." : "Resubmit"}
              </span>
              <span className="text-xs text-[#888]">→</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Profile() {
  // <ProtectedRoute> guarantees user/profile are present before this mounts.
  const { user, profile, isLoadingAuth, logout, updateProfile } = useAuth();
  const navigate = useNavigate();

  usePageMeta({
    title: "Profile",
    description: "Manage your VibedGallery account, submissions, and password.",
    path: "/profile",
    noindex: true,
  });

  const [activeTab, setActiveTab] = useState("account");
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Account tab
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [displayNameError, setDisplayNameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [displayNameLoading, setDisplayNameLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const successTimerRef = useRef(null);

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccessMessage(""), 5000);
  };

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // Identity providers (email/google/github/...)
  const identities = user?.identities || [];
  const providers = identities.map((i) => i.provider);
  const hasPasswordLogin = providers.includes("email");
  const oauthProviders = providers.filter((p) => p !== "email");

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.name || "");
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    fetchSubmissions();
  }, [user]);

  const fetchSubmissions = async () => {
    if (!user) return;
    setLoadingSubmissions(true);
    try {
      const { data, error } = await supabase
        .from("apps")
        .select(APP_SELECT_COLUMNS)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error) {
        setSubmissions(data || []);
      }
    } catch (err) {
      console.error("Error fetching submissions:", err);
    }
    setLoadingSubmissions(false);
  };

  const handleDisplayNameSave = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      setDisplayNameError("Display name cannot be empty");
      return;
    }
    if (trimmed.length > 15) {
      setDisplayNameError("Display name must be 15 characters or less");
      return;
    }

    setDisplayNameLoading(true);
    setDisplayNameError("");
    try {
      await updateProfile({ name: trimmed });
      showSuccess("Display name updated");
    } catch (err) {
      setDisplayNameError(err.message || "Failed to update display name");
    }
    setDisplayNameLoading(false);
  };

  const handlePasswordChange = async () => {
    setPasswordError("");

    if (!currentPassword) {
      setPasswordError("Current password is required");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setPasswordError("Both new password fields are required");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from current password");
      return;
    }

    setPasswordLoading(true);
    try {
      // Supabase verifies the current password server-side when
      // "Require current password when changing password" is enabled.
      // The installed auth-js (2.106.x) forwards attributes as-is, so we
      // must use the raw snake_case key the gotrue server expects.
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      });
      if (error) {
        const code = error.code || "";
        if (code === "incorrect_password" || /incorrect/i.test(error.message)) {
          setPasswordError("Current password is incorrect");
        } else if (code === "same_password") {
          setPasswordError("New password must be different from current password");
        } else {
          setPasswordError(error.message || "Failed to change password");
        }
        setPasswordLoading(false);
        return;
      }

      showSuccess("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err.message || "Failed to change password");
    }
    setPasswordLoading(false);
  };

  const handleSubmissionAction = async (action, app) => {
    setActionLoading(app.id);
    try {
      if (action === "download") {
        // verification_html isn't a column — rebuild from the token (matches the
        // file Submit.jsx originally generated, what the verifier reads).
        const token = app.verification_token;
        if (!token) {
          console.error("No verification_token on app:", app.id);
          return;
        }
        const escapedToken = token
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const html = `<!DOCTYPE html><html><head><meta name="vibedgallery-verification" content="${escapedToken}"><title>VibedGallery Verification</title></head><body>${escapedToken}</body></html>`;
        const filename = `${token}.html`;
        const element = document.createElement("a");
        element.setAttribute(
          "href",
          `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
        );
        element.setAttribute("download", filename);
        element.style.display = "none";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      } else if (action === "view") {
        navigate(`/app/${app.id}`);
      } else if (action === "resubmit") {
        navigate(`/submit?app_id=${app.id}`);
      }
    } catch (err) {
      console.error("Error:", err);
    }
    setActionLoading(null);
  };

  const handleLogout = async () => {
    await logout();
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-white">
        <Nav />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-6 h-6 animate-spin text-[#AAAAAA]" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";

  const displayLabel = displayName || user?.email?.split("@")[0] || "User";
  const tabs = [
    { id: "account", label: "Account" },
    { id: "submissions", label: "Submissions" },
    { id: "analytics", label: "Analytics" },
  ];
  const trimmedDisplayName = displayName.trim();
  const nameUnchanged = trimmedDisplayName === (profile?.name || "");
  const passwordFieldsFilled =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Nav />

      {/* Global success banner */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            key={successMessage}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,420px)] bg-black text-white border border-black flex items-center gap-3 px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <p className="flex-1 text-[10px] font-bold uppercase tracking-widest">
              {successMessage}
            </p>
            <button
              onClick={() => {
                if (successTimerRef.current) clearTimeout(successTimerRef.current);
                setSuccessMessage("");
              }}
              className="text-white/60 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 pt-14">
        {/* Header */}
        <section className="border-b border-[#E5E5E5]">
          <div className="max-w-5xl mx-auto px-8 py-16 overflow-hidden">
            <motion.p
              initial="hidden"
              animate="visible"
              custom={0}
              variants={metaVariants}
              className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-4"
            >
              Profile
            </motion.p>
            <motion.h1
              initial="hidden"
              animate="visible"
              custom={1}
              variants={metaVariants}
              className="text-[clamp(2.5rem,6vw,5rem)] font-black uppercase leading-[0.9] text-black break-words"
              style={{ letterSpacing: "-0.04em" }}
            >
              {displayLabel}
            </motion.h1>

            <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3">
              {[
                { label: "Email", value: user?.email || "—" },
                { label: "Member Since", value: memberSince },
                { label: "Submissions", value: submissions.length },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial="hidden"
                  animate="visible"
                  custom={i + 2}
                  variants={metaVariants}
                >
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA]">
                    {item.label}
                  </p>
                  <p className="text-xs text-black mt-1">{item.value}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="border-b border-[#E5E5E5] bg-white sticky top-14 z-30">
          <div className="max-w-5xl mx-auto flex">
            {tabs.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`h-10 px-6 text-[10px] font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${
                  i === 0 ? "border-l border-[#E5E5E5]" : ""
                } border-r border-[#E5E5E5] ${
                  activeTab === t.id
                    ? "bg-black text-white"
                    : "text-[#717171] hover:text-black"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <section className="max-w-5xl mx-auto px-8 py-12">
            {loadingSubmissions ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-[#AAAAAA]" />
              </div>
            ) : (
              <AnalyticsPanel submissions={submissions} />
            )}
          </section>
        )}

        {/* Submissions Tab */}
        {activeTab === "submissions" && (
          <section className="max-w-5xl mx-auto px-8 py-12">
            {loadingSubmissions ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SubmissionCardSkeleton key={i} />
                ))}
              </div>
            ) : submissions.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="border border-[#E5E5E5] px-10 py-16 flex flex-col items-center text-center"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA]">
                  Empty State
                </p>
                <h2
                  className="mt-3 text-3xl font-black uppercase text-black leading-none"
                  style={{ letterSpacing: "-0.03em" }}
                >
                  No Submissions Yet
                </h2>
                <p className="mt-4 text-sm text-[#717171] max-w-sm leading-relaxed">
                  You haven't submitted any apps. Share what you've vibed into existence.
                </p>
                <Link
                  to="/submit"
                  className="mt-8 h-12 px-8 flex items-center justify-between gap-6 bg-black text-white hover:bg-[#222] transition-colors"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Submit Your First App
                  </span>
                  <span className="text-xs text-[#888]">→</span>
                </Link>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-8">
                {submissions.map((app, i) => (
                  <motion.div
                    key={app.id}
                    custom={i}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <SubmissionCard
                      app={app}
                      onAction={handleSubmissionAction}
                      loading={actionLoading}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Account Tab */}
        {activeTab === "account" && (
          <section className="max-w-3xl mx-auto px-8 py-12 space-y-8">
            {/* Display Name */}
            <div className="border border-[#E5E5E5]">
              <div className="px-6 py-4 border-b border-[#E5E5E5]">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-black">
                  Display Name
                </h3>
              </div>

              {displayNameError && (
                <div className="px-6 py-3 bg-[#FFF0F0] border-b border-[#FFD0D0] flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-black flex-shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black">
                    {displayNameError}
                  </p>
                </div>
              )}

              <div className="px-6 py-4 border-b border-[#E5E5E5]">
                <div className="flex items-baseline justify-between mb-2">
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                    Name
                  </label>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-widest ${
                      trimmedDisplayName.length > 15 ? "text-black" : "text-[#AAAAAA]"
                    }`}
                  >
                    {trimmedDisplayName.length} / 15
                  </span>
                </div>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setDisplayNameError("");
                  }}
                  maxLength={15}
                  placeholder="Enter your display name"
                  className="w-full bg-transparent text-sm text-black placeholder:text-[#AAAAAA] focus:outline-none"
                />
              </div>

              <button
                onClick={handleDisplayNameSave}
                disabled={
                  displayNameLoading ||
                  nameUnchanged ||
                  !trimmedDisplayName ||
                  trimmedDisplayName.length > 15
                }
                className="w-full h-12 px-6 flex items-center justify-between bg-black text-white hover:bg-[#222] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {displayNameLoading ? "Saving..." : "Save Changes"}
                </span>
                {displayNameLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span className="text-xs text-[#888]">→</span>
                )}
              </button>
            </div>

            {/* Connected Accounts */}
            <div className="border border-[#E5E5E5]">
              <div className="px-6 py-4 border-b border-[#E5E5E5]">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-black">
                  Connected Accounts
                </h3>
              </div>
              <div className="divide-y divide-[#E5E5E5]">
                {providers.length === 0 && (
                  <p className="px-6 py-4 text-[11px] text-[#717171]">
                    No sign-in methods linked.
                  </p>
                )}
                {providers.map((p) => (
                  <div
                    key={p}
                    className="px-6 py-3 flex items-center justify-between"
                  >
                    <span className="text-[11px] font-bold uppercase tracking-widest text-black">
                      {p === "email" ? "Email & Password" : p}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                      Connected
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Password */}
            {hasPasswordLogin ? (
              <div className="border border-[#E5E5E5]">
                <div className="px-6 py-4 border-b border-[#E5E5E5]">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-black">
                    Change Password
                  </h3>
                </div>

                {passwordError && (
                  <div className="px-6 py-3 bg-[#FFF0F0] border-b border-[#FFD0D0] flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-black flex-shrink-0" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black">
                      {passwordError}
                    </p>
                  </div>
                )}

                <div className="px-6 py-4 border-b border-[#E5E5E5]">
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-[#717171] mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setPasswordError("");
                    }}
                    placeholder="Enter your current password"
                    autoComplete="current-password"
                    className="w-full bg-transparent text-sm text-black placeholder:text-[#AAAAAA] focus:outline-none"
                  />
                </div>

                <div className="px-6 py-4 border-b border-[#E5E5E5]">
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-[#717171] mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordError("");
                    }}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    className="w-full bg-transparent text-sm text-black placeholder:text-[#AAAAAA] focus:outline-none"
                  />
                </div>

                <div className="px-6 py-4 border-b border-[#E5E5E5]">
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-[#717171] mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPasswordError("");
                    }}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                    className="w-full bg-transparent text-sm text-black placeholder:text-[#AAAAAA] focus:outline-none"
                  />
                </div>

                <button
                  onClick={handlePasswordChange}
                  disabled={passwordLoading || !passwordFieldsFilled}
                  className="w-full h-12 px-6 flex items-center justify-between bg-black text-white hover:bg-[#222] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {passwordLoading ? "Updating..." : "Change Password"}
                  </span>
                  {passwordLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span className="text-xs text-[#888]">→</span>
                  )}
                </button>
              </div>
            ) : (
              <div className="border border-[#E5E5E5]">
                <div className="px-6 py-4 border-b border-[#E5E5E5]">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-black">
                    Password
                  </h3>
                </div>
                <div className="px-6 py-4">
                  <p className="text-[11px] text-[#717171] leading-relaxed">
                    You signed in with{" "}
                    <span className="font-bold text-black uppercase tracking-widest">
                      {oauthProviders.join(", ") || "an external provider"}
                    </span>
                    . Password changes are managed through that provider.
                  </p>
                </div>
              </div>
            )}

            {/* Sign Out */}
            <div className="border border-[#E5E5E5]">
              <div className="px-6 py-4 border-b border-[#E5E5E5]">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-black">
                  Sign Out
                </h3>
                <p className="text-[11px] text-[#717171] mt-1">
                  Sign out of your account on this device.
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full h-12 px-6 flex items-center justify-between bg-white text-black hover:bg-[#F5F5F5] transition-colors"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Sign Out
                </span>
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
