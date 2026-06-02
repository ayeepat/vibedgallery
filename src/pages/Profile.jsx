import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import Nav from "@/components/Nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  Download, 
  LogOut, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2,
  Clock,
  XCircle,
  Mail,
  Calendar
} from "lucide-react";

const STATUS_CONFIG = {
  pending_verification: {
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    icon: Clock,
    label: "Pending Verification",
    nextStep: "Add HTML file to your site"
  },
  pending_review: {
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    icon: Clock,
    label: "Pending Review",
    nextStep: "Under review by our team"
  },
  approved: {
    color: "text-green-600",
    bgColor: "bg-green-100",
    icon: CheckCircle2,
    label: "Approved",
    nextStep: "View in gallery"
  },
  rejected: {
    color: "text-red-600",
    bgColor: "bg-red-100",
    icon: XCircle,
    label: "Rejected",
    nextStep: "Resubmit your app"
  }
};

function UserAvatar({ name = "?" }) {
  const initials = (name || "?")
    .split(" ")
    .map(word => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const colors = [
    "bg-blue-500", "bg-purple-500", "bg-pink-500", "bg-red-500",
    "bg-orange-500", "bg-green-500", "bg-teal-500", "bg-cyan-500"
  ];
  const colorIndex = (name?.charCodeAt(0) || 0) % colors.length;

  return (
    <div className={`w-20 h-20 rounded-full ${colors[colorIndex]} flex items-center justify-center`}>
      <span className="text-white text-2xl font-bold">{initials}</span>
    </div>
  );
}

function SubmissionCard({ app, onAction, loading }) {
  const config = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending_verification;
  const StatusIcon = config.icon;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="w-full h-48 bg-gray-100 overflow-hidden">
        {app.thumbnail_url ? (
          <img
            src={app.thumbnail_url}
            alt={app.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
            <span className="text-gray-400 text-sm">No thumbnail</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-gray-900 line-clamp-2">{app.name}</h3>

        {/* Status Badge */}
        <div className={`flex items-center gap-2 w-fit px-3 py-1 rounded-full ${config.bgColor}`}>
          <StatusIcon className={`w-4 h-4 ${config.color}`} />
          <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
        </div>

        {/* Status Details */}
        <div className="bg-gray-50 p-3 rounded-md space-y-2 text-sm">
          {app.status === "pending_verification" && (
            <>
              <p className="text-gray-700">{config.nextStep}</p>
              <button
                onClick={() => onAction("download", app)}
                disabled={loading === app.id}
                className="w-full flex items-center justify-center gap-2 mt-2 px-3 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                {loading === app.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download file again
              </button>
            </>
          )}

          {app.status === "pending_review" && (
            <>
              <p className="text-green-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                HTML file confirmed ✓
              </p>
              <p className="text-gray-700">{config.nextStep}</p>
              <p className="text-xs text-gray-500">Est. time: 24 hours</p>
            </>
          )}

          {app.status === "approved" && (
            <button
              onClick={() => onAction("view", app)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View in gallery
            </button>
          )}

          {app.status === "rejected" && (
            <>
              <p className="text-gray-700">
                <span className="font-medium">Rejection reason:</span>
              </p>
              <p className="text-gray-600 text-xs italic">{app.rejection_reason || "No reason provided"}</p>
              <button
                onClick={() => onAction("resubmit", app)}
                disabled={loading === app.id}
                className="w-full flex items-center justify-center gap-2 mt-2 px-3 py-2 bg-orange-50 text-orange-600 rounded hover:bg-orange-100 transition-colors disabled:opacity-50"
              >
                {loading === app.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Resubmit"
                )}
              </button>
            </>
          )}
        </div>

        {/* Submitted Date */}
        <p className="text-xs text-gray-500">
          Submitted {new Date(app.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, profile, isAuthenticated, isLoadingAuth, logout, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Account tab
  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
      navigate("/login");
      return;
    }
  }, [isAuthenticated, isLoadingAuth, navigate]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || profile.full_name || "");
    }
  }, [profile]);

  // Fetch user submissions
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
        .select("*")
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
    if (!displayName.trim()) {
      setPasswordError("Display name cannot be empty");
      return;
    }

    setSaveLoading(true);
    try {
      await updateProfile({ display_name: displayName.trim() });
      setSuccessMessage("Display name updated!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setPasswordError(err.message || "Failed to update display name");
    }
    setSaveLoading(false);
  };

  const handlePasswordChange = async () => {
    setPasswordError("");

    if (!newPassword || !confirmPassword) {
      setPasswordError("Both fields are required");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setSaveLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setSuccessMessage("Password changed successfully!");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setPasswordError(err.message || "Failed to change password");
    }
    setSaveLoading(false);
  };

  const handleSubmissionAction = async (action, app) => {
    setActionLoading(app.id);
    try {
      if (action === "download") {
        // Download verification file
        const filename = `verify-${app.id}.html`;
        const element = document.createElement("a");
        element.setAttribute("href", `data:text/html;charset=utf-8,${encodeURIComponent(app.verification_html || "")}`);
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
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !profile) {
    return null;
  }

  const memberSince = profile.created_at 
    ? new Date(profile.created_at).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    : "Unknown";

  return (
    <div className="min-h-screen bg-white">
      <Nav />

      <main className="max-w-5xl mx-auto px-4 py-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row gap-8 mb-12 pb-12 border-b border-gray-200">
          <UserAvatar name={displayName || user?.email} />

          <div className="flex-1 space-y-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{displayName || user?.email}</h1>
              <div className="flex flex-col gap-2 mt-3 text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>{user?.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Member since {memberSince}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <Tabs defaultValue="submissions" className="space-y-6">
          <TabsList className="border-b border-gray-200 rounded-none bg-transparent p-0">
            <TabsTrigger 
              value="submissions" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-gray-900 data-[state=active]:bg-transparent px-4 py-2"
            >
              My Submissions
            </TabsTrigger>
            <TabsTrigger 
              value="account" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-gray-900 data-[state=active]:bg-transparent px-4 py-2"
            >
              Account
            </TabsTrigger>
          </TabsList>

          {/* My Submissions Tab */}
          <TabsContent value="submissions" className="space-y-6">
            {loadingSubmissions ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No submissions yet</p>
                <button
                  onClick={() => navigate("/submit")}
                  className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Submit Your First App
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {submissions.map(app => (
                  <SubmissionCard
                    key={app.id}
                    app={app}
                    onAction={handleSubmissionAction}
                    loading={actionLoading}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-8 max-w-2xl">
            {/* Success Message */}
            {successMessage && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-green-700">{successMessage}</p>
              </div>
            )}

            {/* Change Display Name */}
            <div className="border border-gray-200 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-lg text-gray-900">Change Display Name</h3>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleDisplayNameSave}
                disabled={saveLoading}
                className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saveLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Save Changes"}
              </button>
            </div>

            {/* Change Password */}
            <div className="border border-gray-200 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-lg text-gray-900">Change Password</h3>

              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm">{passwordError}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordError("");
                  }}
                  placeholder="Enter new password (min. 8 characters)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordError("");
                  }}
                  placeholder="Confirm new password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <button
                onClick={handlePasswordChange}
                disabled={saveLoading}
                className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saveLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Change Password"}
              </button>
            </div>

            {/* Logout */}
            <div className="border border-gray-200 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-lg text-gray-900">Logout</h3>
              <p className="text-sm text-gray-600">Sign out of your account on this device.</p>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
