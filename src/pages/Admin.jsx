import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import Nav from "@/components/Nav";
import { Loader2, Check, X, ExternalLink } from "lucide-react";

const STATUS_COLORS = {
  pending_verification: "#717171",
  pending_review: "#B8860B",
  approved: "#2D5016",
  rejected: "#8B0000",
}

const STATUS_LABELS = {
  pending_verification: "Pending Verification",
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
}

export default function Admin() {
  const { user, isAuthenticated, isLoadingAuth } = useAuth()
  const navigate = useNavigate()

  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("pending_review")
  const [selected, setSelected] = useState(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  // Check admin status
  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
      navigate("/login")
      return
    }

    if (user) {
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.role !== "admin") {
            navigate("/")
            return
          }
          setIsAdmin(true)
          setCheckingAdmin(false)
        })
    }
  }, [user, isAuthenticated, isLoadingAuth])

  // Fetch apps
  useEffect(() => {
    if (!isAdmin) return
    fetchApps()
  }, [isAdmin, filter])

  const fetchApps = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("apps")
      .select("*")
      .eq("status", filter)
      .order("created_at", { ascending: false })

    if (!error) setApps(data || [])
    setLoading(false)
  }

  const handleApprove = async (app) => {
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from("apps")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", app.id)

      if (error) throw error

      // Send approval email via Supabase
      // For now just update UI
      setApps((prev) => prev.filter((a) => a.id !== app.id))
      setSelected(null)

    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (app) => {
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason")
      return
    }
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from("apps")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", app.id)

      if (error) throw error

      setApps((prev) => prev.filter((a) => a.id !== app.id))
      setSelected(null)
      setRejectionReason("")

    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  if (checkingAdmin || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#717171]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Nav />

      <div className="pt-14">

        {/* Header */}
        <div className="border-b border-[#E5E5E5] px-8 py-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-2">
            Admin Panel
          </p>
          <h1
            className="text-3xl font-black uppercase leading-none"
            style={{ letterSpacing: "-0.04em" }}
          >
            REVIEW QUEUE.
          </h1>
        </div>

        {/* Filter tabs */}
        <div className="border-b border-[#E5E5E5] flex">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setFilter(key); setSelected(null) }}
              className={`h-12 px-6 text-[10px] font-bold uppercase tracking-widest border-r border-[#E5E5E5] transition-colors ${
                filter === key
                  ? "bg-black text-white"
                  : "bg-white text-[#717171] hover:text-black hover:bg-[#F5F5F5]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex h-[calc(100vh-180px)]">

          {/* App list */}
          <div className="w-[40%] border-r border-[#E5E5E5] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 animate-spin text-[#717171]" />
              </div>
            ) : apps.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171]">
                  No apps in this category
                </p>
              </div>
            ) : (
              apps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => { setSelected(app); setRejectionReason("") }}
                  className={`w-full text-left border-b border-[#E5E5E5] p-4 hover:bg-[#F5F5F5] transition-colors ${
                    selected?.id === app.id ? "bg-[#F5F5F5]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black uppercase tracking-tight text-black truncate">
                        {app.title}
                      </p>
                      <p className="text-[10px] text-[#717171] truncate mt-0.5">
                        {app.tagline}
                      </p>
                      <p className="text-[9px] text-[#AAAAAA] mt-1">
                        {app.submitter_email}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <span
                        className="text-[8px] font-bold uppercase tracking-widest px-2 py-1"
                        style={{
                          color: STATUS_COLORS[app.status],
                          border: `1px solid ${STATUS_COLORS[app.status]}44`,
                          background: `${STATUS_COLORS[app.status]}11`,
                        }}
                      >
                        {app.safe_browsing_passed ? "✓ Safe" : "⚠ Flagged"}
                      </span>
                    </div>
                  </div>
                  <p className="text-[9px] text-[#AAAAAA] mt-2">
                    {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))
            )}
          </div>

          {/* Detail panel */}
          <div className="flex-1 overflow-y-auto">
            {!selected ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171]">
                  Select an app to review
                </p>
              </div>
            ) : (
              <div className="p-8">

                {/* Thumbnail */}
                {selected.thumbnail_url && (
                  <div className="border border-[#E5E5E5] aspect-video overflow-hidden mb-6 max-w-md">
                    <img
                      src={selected.thumbnail_url}
                      alt={selected.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* App info */}
                <div className="mb-6">
                  <h2
                    className="text-2xl font-black uppercase leading-none mb-2"
                    style={{ letterSpacing: "-0.04em" }}
                  >
                    {selected.title}
                  </h2>
                  <p className="text-sm text-[#717171] mb-4">{selected.tagline}</p>
                  <p className="text-xs text-[#717171] leading-relaxed mb-4">
                    {selected.description}
                  </p>
                </div>

                {/* Details grid */}
                <div className="border border-[#E5E5E5] mb-6">
                  {[
                    ["URL", selected.url],
                    ["Category", selected.category],
                    ["Primary Tool", selected.primary_tool],
                    ["Other Tools", selected.other_tools],
                    ["Tags", selected.tags?.join(", ")],
                    ["Submitted By", selected.submitter_email],
                    ["Twitter", selected.submitter_twitter],
                    ["GitHub", selected.submitter_github],
                    ["Ownership Verified", selected.ownership_verified ? "Yes" : "No"],
                    ["Safe Browsing", selected.safe_browsing_passed ? "Passed ✓" : `Failed — ${selected.safe_browsing_threats?.join(", ")}`],
                    ["Verification Token", selected.verification_token],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label} className="flex border-b border-[#E5E5E5] last:border-0">
                      <div className="w-40 shrink-0 px-4 py-3 bg-[#F5F5F5] border-r border-[#E5E5E5]">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                          {label}
                        </span>
                      </div>
                      <div className="flex-1 px-4 py-3">
                        <span className="text-xs text-black break-all">
                          {label === "URL" ? (
                            <a
                              href={value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:underline"
                            >
                              {value}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Screenshots */}
                {selected.screenshot_urls?.length > 0 && (
                  <div className="mb-6">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#717171] mb-3">
                      Screenshots
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {selected.screenshot_urls.map((url, i) => (
                        <div key={i} className="border border-[#E5E5E5] aspect-video overflow-hidden">
                          <img src={url} alt={`screenshot ${i}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {(selected.status === "pending_review" || selected.status === "pending_verification") && (
                  <div className="border border-[#E5E5E5]">

                    {/* Rejection reason */}
                    <div className="border-b border-[#E5E5E5]">
                      <label className="block px-4 pt-3 text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                        Rejection Reason (required if rejecting)
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Tell the submitter why their app was rejected..."
                        rows={3}
                        className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none resize-none"
                      />
                    </div>

                    <div className="flex">
                      <button
                        onClick={() => handleApprove(selected)}
                        disabled={actionLoading}
                        className="flex-1 h-14 flex items-center justify-center gap-2 bg-black text-white hover:bg-[#222] transition-colors border-r border-[#333] disabled:opacity-50"
                      >
                        {actionLoading
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Check className="w-4 h-4" />
                        }
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                          Approve
                        </span>
                      </button>
                      <button
                        onClick={() => handleReject(selected)}
                        disabled={actionLoading}
                        className="flex-1 h-14 flex items-center justify-center gap-2 bg-white text-black hover:bg-[#F5F5F5] transition-colors disabled:opacity-50"
                      >
                        {actionLoading
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <X className="w-4 h-4" />
                        }
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                          Reject
                        </span>
                      </button>
                    </div>

                  </div>
                )}

              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}