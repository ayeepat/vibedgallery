import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { sendEmail, verifyHtml } from "@/lib/edgeFunctions";
import { APP_SELECT_COLUMNS } from "@/lib/useApps";
import Nav from "@/components/Nav";
import { Loader2, Check, X, ExternalLink, Search, ShieldCheck } from "lucide-react";

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
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const [recheckLoading, setRecheckLoading] = useState(false)
  // submitter_email is no longer SELECT-able from the client; fetch on demand
  // via a SECURITY DEFINER RPC for the selected row only.
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [emailLoading, setEmailLoading] = useState(false)

  useEffect(() => {
    if (!selected?.id) {
      setSelectedEmail(null)
      return
    }
    let cancelled = false
    setEmailLoading(true)
    setSelectedEmail(null)
    supabase
      .rpc("get_app_submitter_email", { target_app_id: selected.id })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error("Failed to fetch submitter email:", error)
          setSelectedEmail(null)
        } else {
          setSelectedEmail(data ?? null)
        }
        setEmailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected?.id])

  const handleRecheck = async (app) => {
    if (!app?.verification_token || !app?.url) {
      setVerifyResult({
        verified: false,
        reason: "Missing verification_token or url",
        checked: [],
      })
      return
    }
    setRecheckLoading(true)
    setVerifyResult(null)
    try {
      const result = await verifyHtml(app.url, app.verification_token)
      setVerifyResult(result)

      // Persist ownership_verified if newly confirmed so we don't re-check on approve.
      if (result.verified && !app.ownership_verified) {
        const { error } = await supabase
          .from("apps")
          .update({ ownership_verified: true })
          .eq("id", app.id)
        if (!error) {
          setApps((prev) =>
            prev.map((a) =>
              a.id === app.id ? { ...a, ownership_verified: true } : a
            )
          )
          setSelected((s) => (s ? { ...s, ownership_verified: true } : s))
        }
      }
    } catch (err) {
      setVerifyResult({
        verified: false,
        reason: err?.message || "Check failed",
        checked: [],
      })
    } finally {
      setRecheckLoading(false)
    }
  }

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
    const t = setTimeout(fetchApps, search.trim() ? 250 : 0)
    return () => clearTimeout(t)
  }, [isAdmin, filter, search])

  const fetchApps = async () => {
    setLoading(true)
    const term = search.trim()

    let query = supabase.from("apps").select(APP_SELECT_COLUMNS)

    // Admin search queries ALL statuses; otherwise scope to the active tab.
    // (submitter_email is no longer SELECT-able from the API, so we can't
    // search it here. To search by email, fall back to clicking into a row.)
    if (term) {
      query = query.or(
        `title.ilike.%${term}%,tagline.ilike.%${term}%,primary_tool.ilike.%${term}%,category.ilike.%${term}%`
      )
    } else {
      query = query.eq("status", filter)
    }

    const { data, error } = await query.order("created_at", { ascending: false })

    if (!error) setApps(data || [])
    setLoading(false)
  }

  const handleApprove = async (app) => {
    setActionLoading(true)
    setVerifyResult(null)
    try {
      // Server-side check that the verification file really exists at the URL.
      let result = { verified: true }
      if (app.verification_token && app.url) {
        result = await verifyHtml(app.url, app.verification_token)
        setVerifyResult(result)
        if (!result.verified) {
          const proceed = window.confirm(
            `Ownership file NOT found at ${app.url} (${result.reason || "no match"}).\n\nApprove anyway?`
          )
          if (!proceed) {
            setActionLoading(false)
            return
          }
        }
      }

      const { error } = await supabase
        .from("apps")
        .update({
          status: "approved",
          ownership_verified: result.verified,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", app.id)

      if (error) throw error

      // Notify the submitter their app is live.
      // selectedEmail is fetched via SECURITY DEFINER RPC; falls through to
      // the edge function which can re-derive it from auth.users if needed.
      sendEmail("approved", {
        id: app.id,
        title: app.title,
        url: app.url,
        submitter_email: selectedEmail,
      })

      setApps((prev) => prev.filter((a) => a.id !== app.id))
      setSelected(null)
      setVerifyResult(null)

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

      // Notify the submitter with the rejection reason.
      sendEmail(
        "rejected",
        {
          id: app.id,
          title: app.title,
          submitter_email: selectedEmail,
        },
        { rejectionReason }
      )

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

        {/* Search — admins search across ALL statuses */}
        <div className="border-b border-[#E5E5E5] px-8 py-3 flex items-center gap-3">
          <Search className="w-4 h-4 text-[#717171] shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelected(null) }}
            placeholder="Search all submissions — title, tagline, or email..."
            className="flex-1 h-8 text-xs text-black bg-transparent placeholder:text-[#AAAAAA] focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black transition-colors"
            >
              Clear ✕
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className={`border-b border-[#E5E5E5] flex ${search.trim() ? "opacity-40 pointer-events-none" : ""}`}>
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
                  {search.trim() ? `No results for "${search.trim()}"` : "No apps in this category"}
                </p>
              </div>
            ) : (
              apps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => { setSelected(app); setRejectionReason(""); setVerifyResult(null) }}
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
                        {new Date(app.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span
                        className="text-[8px] font-bold uppercase tracking-widest px-2 py-1"
                        style={{
                          color: STATUS_COLORS[app.status],
                          border: `1px solid ${STATUS_COLORS[app.status]}44`,
                          background: `${STATUS_COLORS[app.status]}11`,
                        }}
                      >
                        {STATUS_LABELS[app.status] || app.status}
                      </span>
                      <span className="text-[8px] font-bold uppercase tracking-widest text-[#717171]">
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
                    ["Submitted By", emailLoading ? "Loading…" : (selectedEmail ?? "—")],
                    ["Twitter", selected.submitter_twitter],
                    ["GitHub", selected.submitter_github],
                    ["Ownership Verified", selected.ownership_verified ? "Yes (trusted — not re-checked)" : "No"],
                    ["Safe Browsing", selected.safe_browsing_passed ? "Passed ✓" : `Failed — ${selected.safe_browsing_threats?.join(", ")}`],
                    ["Verification Token", selected.verification_token],
                    ["Verification File", selected.verification_token ? `${selected.verification_token}.html` : null],
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
                          ) : label === "Verification File" ? (
                            <a
                              href={`${(selected.url || "").replace(/\/+$/, "")}/${value}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:underline font-mono"
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

                    {/* Verification result */}
                    {verifyResult && (
                      <div
                        className="px-4 py-3 border-b border-[#E5E5E5]"
                        style={{
                          color: verifyResult.verified ? STATUS_COLORS.approved : STATUS_COLORS.rejected,
                          background: verifyResult.verified ? `${STATUS_COLORS.approved}11` : `${STATUS_COLORS.rejected}11`,
                        }}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-widest">
                          {verifyResult.verified
                            ? `✓ Ownership file verified (${verifyResult.method})`
                            : `⚠ Ownership file not found — ${verifyResult.reason || "no match"}`}
                        </p>
                        {!verifyResult.verified && verifyResult.checked?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-[9px] font-bold uppercase tracking-widest opacity-70">
                              Checked these URLs:
                            </p>
                            {verifyResult.checked.map((u) => (
                              <a
                                key={u}
                                href={u}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-[10px] font-mono underline break-all hover:opacity-70"
                              >
                                {u}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

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

                    {/* Re-check ownership file */}
                    {selected.verification_token && selected.url && (
                      <button
                        onClick={() => handleRecheck(selected)}
                        disabled={recheckLoading || actionLoading}
                        className="w-full h-12 flex items-center justify-center gap-2 bg-white text-black hover:bg-[#F5F5F5] transition-colors border-b border-[#E5E5E5] disabled:opacity-50"
                      >
                        {recheckLoading
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <ShieldCheck className="w-3.5 h-3.5" />
                        }
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                          {recheckLoading ? "Checking..." : "Re-run Verification Check"}
                        </span>
                      </button>
                    )}

                    <div className="flex">
                      <button
                        onClick={() => handleApprove(selected)}
                        disabled={actionLoading || recheckLoading}
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
                        disabled={actionLoading || recheckLoading}
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