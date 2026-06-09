import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { sendEmail, verifyHtml } from "@/lib/edgeFunctions";
import { checkUrlSafety } from "@/lib/safeBrowsing";
import { APP_SELECT_COLUMNS } from "@/lib/useApps";
import { sanitizeSearchTerm } from "@/lib/urlHelpers";
import Nav from "@/components/Nav";
import { Loader2, Check, X, ExternalLink, Search, ShieldCheck, Flag, Pencil } from "lucide-react";

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
  // Route-level <ProtectedRoute adminOnly> already guarantees the caller is
  // signed-in AND admin before this component mounts — no need to re-check.
  const { user } = useAuth()
  const [section, setSection] = useState("queue") // "queue" | "edits" | "reports"
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

  // Fetch apps
  useEffect(() => {
    const t = setTimeout(fetchApps, search.trim() ? 250 : 0)
    return () => clearTimeout(t)
  }, [filter, search])

  const fetchApps = async () => {
    setLoading(true)
    // Strip PostgREST/SQL-LIKE meta chars + cap length so the `.or()` filter
    // can't be coerced into another column or generate a multi-KB URL.
    const term = sanitizeSearchTerm(search)

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

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(200)

    if (!error) setApps(data || [])
    setLoading(false)
  }

  const handleApprove = async (app) => {
    setActionLoading(true)
    setVerifyResult(null)
    try {
      // Re-run Google Safe Browsing against the live URL at approval time.
      // The safe_browsing_passed flag stored at submission is supplied by the
      // client and must NOT be trusted — a crafted insert could set it true on
      // a malicious URL. We recompute it server-side here before the app can go
      // public, and require an explicit override if it's flagged.
      if (app.url) {
        const safety = await checkUrlSafety(app.url)
        if (safety.error) {
          const proceed = window.confirm(
            `Could not re-check URL safety (${safety.error}).\n\nApprove anyway?`
          )
          if (!proceed) { setActionLoading(false); return }
        } else if (!safety.safe && !safety.skipped) {
          const proceed = window.confirm(
            `⚠ URL flagged UNSAFE by Safe Browsing: ${(safety.threats || []).join(", ")}\n${app.url}\n\nApprove anyway?`
          )
          if (!proceed) { setActionLoading(false); return }
        }
      }

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

      // ownership_verified reflects the LATEST server-side verifyHtml outcome
      // only. We don't OR with the existing row value: that path used to
      // preserve a stale `true` set by another caller, which was exploitable
      // when an admin force-approved over a currently-failing check.
      //
      // The previous-row sticky behavior is still safe in the no-token branch
      // because `result.verified` is initialized to `true` above for rows
      // without a verification_token/url — those rows never go through
      // verifyHtml in the first place.
      const { error } = await supabase
        .from("apps")
        .update({
          status: "approved",
          ownership_verified: result.verified === true,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", app.id)

      if (error) throw error

      // Recipient + content are derived server-side from app.id.
      sendEmail("approved", { id: app.id })

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

      // Recipient + content are derived server-side from app.id.
      sendEmail("rejected", { id: app.id }, { rejectionReason })

      setApps((prev) => prev.filter((a) => a.id !== app.id))
      setSelected(null)
      setRejectionReason("")

    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
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
            {section === "reports" ? "REPORTS." : section === "edits" ? "EDITS." : "REVIEW QUEUE."}
          </h1>
        </div>

        {/* Section switcher — queue vs edits vs reports */}
        <div className="border-b border-[#E5E5E5] flex">
          <button
            onClick={() => setSection("queue")}
            className={`h-10 px-6 text-[10px] font-bold uppercase tracking-widest border-r border-[#E5E5E5] transition-colors ${
              section === "queue" ? "bg-black text-white" : "text-[#717171] hover:text-black hover:bg-[#F5F5F5]"
            }`}
          >
            Queue
          </button>
          <button
            onClick={() => setSection("edits")}
            className={`h-10 px-6 text-[10px] font-bold uppercase tracking-widest border-r border-[#E5E5E5] transition-colors inline-flex items-center gap-2 ${
              section === "edits" ? "bg-black text-white" : "text-[#717171] hover:text-black hover:bg-[#F5F5F5]"
            }`}
          >
            <Pencil className="w-3 h-3" /> Edits
          </button>
          <button
            onClick={() => setSection("reports")}
            className={`h-10 px-6 text-[10px] font-bold uppercase tracking-widest border-r border-[#E5E5E5] transition-colors inline-flex items-center gap-2 ${
              section === "reports" ? "bg-black text-white" : "text-[#717171] hover:text-black hover:bg-[#F5F5F5]"
            }`}
          >
            <Flag className="w-3 h-3" /> Reports
          </button>
        </div>

        {section === "reports" ? <ReportsPanel /> : section === "edits" ? <EditsPanel /> : <>
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
                          <img src={url} alt={`${selected.title || "App"} screenshot ${i + 1}`} className="w-full h-full object-cover" />
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
                      <div className="flex items-center justify-between px-4 pt-3">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                          Rejection Reason (required if rejecting)
                        </label>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-widest tabular-nums ${
                            rejectionReason.length > 1900 ? "text-red-600" : "text-[#AAAAAA]"
                          }`}
                        >
                          {rejectionReason.length} / 2000
                        </span>
                      </div>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value.slice(0, 2000))}
                        maxLength={2000}
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
        </>}
      </div>
    </div>
  )
}

// Reports inbox — lists all reports filed via the ReportDialog. Newest first,
// with an "Unresolved only" toggle and a per-row resolve button. Reads/writes
// are gated by the reports table's RLS policies (admin-only update).
function ReportsPanel() {
  const { user } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading]   = useState(true)
  const [unresolvedOnly, setUnresolvedOnly] = useState(true)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const load = async () => {
      let query = supabase
        .from("reports")
        .select("id, app_id, reporter_id, reason, category, resolved, resolved_at, created_at, apps:app_id (title, url, status)")
        .order("created_at", { ascending: false })
        .limit(200)
      if (unresolvedOnly) query = query.eq("resolved", false)
      const { data, error } = await query
      if (cancelled) return
      if (error) {
        console.error("Failed to load reports:", error)
        setReports([])
      } else {
        setReports(data || [])
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [unresolvedOnly])

  const handleResolve = async (report, resolved) => {
    setBusyId(report.id)
    const { error } = await supabase
      .from("reports")
      .update({
        resolved,
        resolved_by: resolved ? user.id : null,
        resolved_at: resolved ? new Date().toISOString() : null,
      })
      .eq("id", report.id)
    if (error) {
      console.error("Failed to update report:", error)
    } else {
      // When the filter is "Unresolved only" and we just resolved the row, it
      // no longer belongs in the list — drop it. Same goes for reopening a row
      // while "all reports" is on: just flip the fields in place.
      setReports((prev) => {
        if (resolved && unresolvedOnly) {
          return prev.filter((r) => r.id !== report.id)
        }
        return prev.map((r) =>
          r.id === report.id
            ? {
                ...r,
                resolved,
                resolved_at: resolved ? new Date().toISOString() : null,
              }
            : r
        )
      })
    }
    setBusyId(null)
  }

  return (
    <div>
      <div className="border-b border-[#E5E5E5] px-8 py-3 flex items-center gap-4">
        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#717171] cursor-pointer">
          <input
            type="checkbox"
            checked={unresolvedOnly}
            onChange={(e) => setUnresolvedOnly(e.target.checked)}
            className="accent-black"
          />
          Unresolved only
        </label>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA]">
          {reports.length} {unresolvedOnly ? "open" : "total"}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-[#717171]" />
        </div>
      ) : reports.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171]">
            {unresolvedOnly ? "No unresolved reports" : "No reports filed"}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[#E5E5E5]">
          {reports.map((r) => (
            <li key={r.id} className="px-8 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-black border border-[#E5E5E5] px-2 py-0.5">
                      {r.category}
                    </span>
                    {r.resolved ? (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[#2D5016] border border-[#2D501644] bg-[#2D501611] px-2 py-0.5">
                        Resolved
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[#8B0000] border border-[#8B000044] bg-[#8B000011] px-2 py-0.5">
                        Open
                      </span>
                    )}
                    <span className="text-[9px] text-[#AAAAAA]">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm font-black uppercase tracking-tight text-black break-words">
                    {r.apps?.title || "(app not found)"}
                  </p>
                  {r.apps?.url && (
                    <a
                      href={r.apps.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#717171] hover:text-black underline break-all inline-flex items-center gap-1"
                    >
                      {r.apps.url} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <p className="mt-2 text-xs text-black leading-relaxed whitespace-pre-wrap break-words border-l-2 border-[#E5E5E5] pl-3">
                    {r.reason}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA]">
                    <span>Reporter: {r.reporter_id ? r.reporter_id.slice(0, 8) : "anon"}</span>
                    <Link
                      to={`/app/${r.app_id}`}
                      className="text-[#717171] hover:text-black underline"
                    >
                      Open in gallery →
                    </Link>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col gap-2">
                  {r.resolved ? (
                    <button
                      onClick={() => handleResolve(r, false)}
                      disabled={busyId === r.id}
                      className="h-9 px-4 bg-white text-black border border-[#E5E5E5] text-[10px] font-bold uppercase tracking-widest hover:border-black transition-colors disabled:opacity-50"
                    >
                      {busyId === r.id ? "..." : "Reopen"}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleResolve(r, true)}
                      disabled={busyId === r.id}
                      className="h-9 px-4 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Edits queue — pending creator edits to approved apps ─────────────
// Master/detail layout mirroring the main queue. The detail panel shows ONLY
// fields that differ between the current apps row and the proposed edit, with
// the previous value and the proposed value side-by-side. Approve copies the
// edit fields onto the apps row and marks the edit approved; reject just
// stamps the rejection reason. Live apps row is not touched on reject.

const EDIT_STATUS_LABELS = {
  pending_verification: "Pending Verification",
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
}

// The editable subset of apps that the diff cares about, in display order.
const DIFF_FIELDS = [
  { key: "title",            label: "Title",          kind: "text" },
  { key: "tagline",          label: "Tagline",        kind: "text" },
  { key: "description",      label: "Description",    kind: "longtext" },
  { key: "url",              label: "URL",            kind: "url" },
  { key: "category",         label: "Category",       kind: "text" },
  { key: "tags",             label: "Tags",           kind: "array" },
  { key: "primary_tool",     label: "Primary Tool",   kind: "text" },
  { key: "other_tools",      label: "Other Tools",    kind: "text" },
  { key: "demo_video_url",   label: "Demo Video",     kind: "url" },
  { key: "slug",             label: "Slug",           kind: "text" },
  { key: "submitter_twitter",label: "Twitter",        kind: "text" },
  { key: "submitter_github", label: "GitHub",         kind: "url" },
  { key: "thumbnail_url",    label: "Thumbnail",      kind: "image" },
  { key: "screenshot_urls",  label: "Screenshots",    kind: "imagelist" },
]

// Equality used for the diff. Arrays compare element-by-element; null and ""
// are treated as the same "no value" so the admin doesn't see a noise diff
// for an optional field a creator never set.
function valuesEqual(a, b) {
  const empty = (v) => v == null || v === ""
  if (empty(a) && empty(b)) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    const aa = Array.isArray(a) ? a : []
    const bb = Array.isArray(b) ? b : []
    if (aa.length !== bb.length) return false
    for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false
    return true
  }
  return a === b
}

function ValueCell({ value, kind }) {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
    return <span className="text-[10px] text-[#AAAAAA] italic">— empty —</span>
  }
  if (kind === "array") {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((t) => (
          <span key={t} className="text-[10px] border border-[#E5E5E5] px-2 py-0.5">{t}</span>
        ))}
      </div>
    )
  }
  if (kind === "image") {
    return (
      <div className="border border-[#E5E5E5] aspect-video w-48 overflow-hidden">
        <img src={value} alt="" className="w-full h-full object-cover" />
      </div>
    )
  }
  if (kind === "imagelist") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {value.map((u, i) => (
          <div key={i} className="border border-[#E5E5E5] aspect-video overflow-hidden">
            <img src={u} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    )
  }
  if (kind === "url") {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-black hover:underline break-all inline-flex items-center gap-1">
        {value} <ExternalLink className="w-3 h-3 shrink-0" />
      </a>
    )
  }
  if (kind === "longtext") {
    return <p className="text-xs text-black leading-relaxed whitespace-pre-wrap break-words">{value}</p>
  }
  return <span className="text-xs text-black break-all">{value}</span>
}

function EditsPanel() {
  const { user } = useAuth()
  const [edits, setEdits] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // joined row: edit + apps (current)
  const [filter, setFilter] = useState("pending_review")
  const [rejectionReason, setRejectionReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const [recheckLoading, setRecheckLoading] = useState(false)

  const fetchEdits = async () => {
    setLoading(true)
    // Embed the live apps row so the diff has both sides in one round-trip.
    // PostgREST resolves app_edits.app_id -> apps.id via the FK we declared.
    const { data, error } = await supabase
      .from("app_edits")
      .select(`
        id, app_id, user_id, status, created_at, reviewed_at, reviewed_by,
        rejection_reason, verification_token, ownership_verified,
        safe_browsing_passed, safe_browsing_threats,
        title, tagline, description, url, category, tags,
        primary_tool, other_tools, demo_video_url,
        thumbnail_url, screenshot_urls, slug,
        submitter_twitter, submitter_github,
        apps:app_id (
          id, title, tagline, description, url, category, tags,
          primary_tool, other_tools, demo_video_url,
          thumbnail_url, screenshot_urls, slug,
          submitter_twitter, submitter_github,
          verification_token, ownership_verified, status
        )
      `)
      .in("status", filter === "all"
        ? ["pending_verification", "pending_review", "approved", "rejected"]
        : [filter])
      .order("created_at", { ascending: false })
      .limit(200)
    if (!error) setEdits(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchEdits()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  // Compute the diff list — only fields that actually changed.
  const diff = selected
    ? DIFF_FIELDS
        .map((f) => ({ ...f, prev: selected.apps?.[f.key], next: selected[f.key] }))
        .filter((f) => !valuesEqual(f.prev, f.next))
    : []

  const urlChanged = selected && selected.apps && normalizeNullable(selected.url) !== normalizeNullable(selected.apps.url)

  const handleRecheck = async () => {
    if (!selected?.verification_token || !selected?.url) {
      setVerifyResult({ verified: false, reason: "Missing token or url", checked: [] })
      return
    }
    setRecheckLoading(true)
    setVerifyResult(null)
    try {
      const result = await verifyHtml(selected.url, selected.verification_token)
      setVerifyResult(result)
      if (result.verified && !selected.ownership_verified) {
        await supabase
          .from("app_edits")
          .update({ ownership_verified: true })
          .eq("id", selected.id)
        setSelected((s) => s ? { ...s, ownership_verified: true } : s)
        setEdits((prev) => prev.map((e) => e.id === selected.id ? { ...e, ownership_verified: true } : e))
      }
    } catch (err) {
      setVerifyResult({ verified: false, reason: err?.message || "Check failed", checked: [] })
    } finally {
      setRecheckLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!selected) return
    setActionLoading(true)
    try {
      // If URL changed, re-run Safe Browsing on the new URL before we commit
      // it to the live apps row. If we can't reach it, prompt rather than
      // block. The verdict is passed into the apply RPC so the apps row
      // reflects the fresh check, not the value the creator submitted with.
      let safeBrowsingPassed = null
      let safeBrowsingThreats = null
      if (urlChanged) {
        const safety = await checkUrlSafety(selected.url)
        if (safety.error) {
          const proceed = window.confirm(
            `Could not re-check URL safety (${safety.error}).\n\nApprove anyway?`
          )
          if (!proceed) { setActionLoading(false); return }
        } else if (!safety.safe && !safety.skipped) {
          const proceed = window.confirm(
            `⚠ New URL flagged UNSAFE: ${(safety.threats || []).join(", ")}\n${selected.url}\n\nApprove anyway?`
          )
          if (!proceed) { setActionLoading(false); return }
        }
        // Pass only on a real clean verdict — a skipped/degraded check is
        // recorded as a non-pass so the row's badge reflects the truth.
        safeBrowsingPassed = safety.safe === true && !safety.skipped
        safeBrowsingThreats = safety.threats || []
      }

      // Single SECURITY DEFINER RPC handles both the apps UPDATE and the
      // app_edits status flip atomically. It also sidesteps column-level
      // GRANT restrictions on apps (e.g. verification_token, safe_browsing_*)
      // that block admins from updating those columns directly from the
      // client — the function runs with the owner's privileges and does its
      // own admin-role check.
      const { error: rpcErr } = await supabase.rpc("apply_app_edit", {
        p_edit_id: selected.id,
        p_safe_browsing_passed: safeBrowsingPassed,
        p_safe_browsing_threats: safeBrowsingThreats,
      })
      if (rpcErr) {
        // 23505 = unique_violation. Most likely the (user_id, lower(slug))
        // constraint colliding with another app this creator now owns at the
        // same slug. Surface a useful message instead of dumping the raw
        // constraint name.
        if (rpcErr.code === "23505") {
          alert(
            `Can't approve — the proposed slug "${selected.slug}" conflicts with another of this creator's apps. Ask them to pick a different slug, or reject this edit.`
          )
          return
        }
        throw rpcErr
      }

      sendEmail("edit_approved", { id: selected.app_id }, { editId: selected.id })

      setEdits((prev) => prev.filter((e) => e.id !== selected.id))
      setSelected(null)
      setRejectionReason("")
      setVerifyResult(null)
    } catch (err) {
      console.error(err)
      alert(`Failed to approve edit: ${err?.message || err}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selected) return
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason")
      return
    }
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from("app_edits")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selected.id)
      if (error) throw error

      sendEmail("edit_rejected", { id: selected.app_id }, { editId: selected.id, rejectionReason })

      setEdits((prev) => prev.filter((e) => e.id !== selected.id))
      setSelected(null)
      setRejectionReason("")
    } catch (err) {
      console.error(err)
      alert(`Failed to reject edit: ${err?.message || err}`)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      {/* Filter tabs */}
      <div className="border-b border-[#E5E5E5] flex">
        {Object.entries(EDIT_STATUS_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setFilter(key); setSelected(null); setVerifyResult(null) }}
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

      <div className="flex h-[calc(100vh-220px)]">
        {/* Edit list */}
        <div className="w-[40%] border-r border-[#E5E5E5] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-[#717171]" />
            </div>
          ) : edits.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171]">
                No edits in this category
              </p>
            </div>
          ) : (
            edits.map((edit) => (
              <button
                key={edit.id}
                onClick={() => { setSelected(edit); setRejectionReason(""); setVerifyResult(null) }}
                className={`w-full text-left border-b border-[#E5E5E5] p-4 hover:bg-[#F5F5F5] transition-colors ${
                  selected?.id === edit.id ? "bg-[#F5F5F5]" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black uppercase tracking-tight text-black truncate">
                      {edit.apps?.title || edit.title}
                    </p>
                    <p className="text-[10px] text-[#717171] truncate mt-0.5">
                      Editing: {edit.title}
                    </p>
                    <p className="text-[9px] text-[#AAAAAA] mt-1">
                      {new Date(edit.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-[8px] font-bold uppercase tracking-widest px-2 py-1"
                    style={{
                      color: STATUS_COLORS[edit.status],
                      border: `1px solid ${STATUS_COLORS[edit.status]}44`,
                      background: `${STATUS_COLORS[edit.status]}11`,
                    }}
                  >
                    {EDIT_STATUS_LABELS[edit.status]}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171]">
                Select an edit to review
              </p>
            </div>
          ) : (
            <div className="p-8">
              <div className="mb-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-2">
                  Edit on
                </p>
                <h2 className="text-2xl font-black uppercase leading-none mb-2" style={{ letterSpacing: "-0.04em" }}>
                  {selected.apps?.title || selected.title}
                </h2>
                <p className="text-[10px] text-[#AAAAAA]">
                  Submitted {new Date(selected.created_at).toLocaleString()}
                </p>
              </div>

              {urlChanged && (
                <div className="border border-[#E5E5E5] mb-4 px-4 py-3 bg-[#FFF8E6]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black">
                    ⚠ URL changed — re-run verification on the new URL before approving
                  </p>
                  <p className="text-[10px] text-[#717171] mt-1">
                    Verification token: <span className="font-mono">{selected.verification_token || "—"}</span>
                  </p>
                  <p className="text-[10px] text-[#717171] mt-0.5">
                    Ownership: {selected.ownership_verified ? "Verified ✓" : "Not yet verified"}
                  </p>
                </div>
              )}

              {diff.length === 0 ? (
                <div className="border border-[#E5E5E5] p-6 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171]">
                    No changes detected vs. live values
                  </p>
                </div>
              ) : (
                <div className="border border-[#E5E5E5] mb-6">
                  <div className="px-4 py-3 border-b border-[#E5E5E5] bg-[#F5F5F5]">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                      Changes ({diff.length})
                    </span>
                  </div>
                  {diff.map((f) => (
                    <div key={f.key} className="border-b border-[#E5E5E5] last:border-0">
                      <div className="px-4 py-2 bg-[#FAFAFA] border-b border-[#E5E5E5]">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-black">
                          {f.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-[#E5E5E5]">
                        <div className="px-4 py-3">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA] mb-2">
                            Previous
                          </p>
                          <ValueCell value={f.prev} kind={f.kind} />
                        </div>
                        <div className="px-4 py-3 bg-[#F5FAF5]">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-[#2D5016] mb-2">
                            Proposed
                          </p>
                          <ValueCell value={f.next} kind={f.kind} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Verify result */}
              {verifyResult && (
                <div
                  className="px-4 py-3 border border-[#E5E5E5] mb-4"
                  style={{
                    color: verifyResult.verified ? STATUS_COLORS.approved : STATUS_COLORS.rejected,
                    background: verifyResult.verified ? `${STATUS_COLORS.approved}11` : `${STATUS_COLORS.rejected}11`,
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest">
                    {verifyResult.verified
                      ? `✓ Ownership file verified at new URL (${verifyResult.method})`
                      : `⚠ Ownership file not found — ${verifyResult.reason || "no match"}`}
                  </p>
                </div>
              )}

              {/* Only show actions on still-pending edits */}
              {(selected.status === "pending_review" || selected.status === "pending_verification") && (
                <div className="border border-[#E5E5E5]">
                  <div className="border-b border-[#E5E5E5]">
                    <div className="flex items-center justify-between px-4 pt-3">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                        Rejection Reason (required if rejecting)
                      </label>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-widest tabular-nums ${
                          rejectionReason.length > 1900 ? "text-red-600" : "text-[#AAAAAA]"
                        }`}
                      >
                        {rejectionReason.length} / 2000
                      </span>
                    </div>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value.slice(0, 2000))}
                      maxLength={2000}
                      placeholder="Tell the creator why their edit was rejected..."
                      rows={3}
                      className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none resize-none"
                    />
                  </div>

                  {urlChanged && selected.verification_token && selected.url && (
                    <button
                      onClick={handleRecheck}
                      disabled={recheckLoading || actionLoading}
                      className="w-full h-12 flex items-center justify-center gap-2 bg-white text-black hover:bg-[#F5F5F5] transition-colors border-b border-[#E5E5E5] disabled:opacity-50"
                    >
                      {recheckLoading
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <ShieldCheck className="w-3.5 h-3.5" />
                      }
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        {recheckLoading ? "Checking..." : "Re-run Verification On New URL"}
                      </span>
                    </button>
                  )}

                  <div className="flex">
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading || recheckLoading}
                      className="flex-1 h-14 flex items-center justify-center gap-2 bg-black text-white hover:bg-[#222] transition-colors border-r border-[#333] disabled:opacity-50"
                    >
                      {actionLoading
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Check className="w-4 h-4" />
                      }
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        Approve Edit
                      </span>
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={actionLoading || recheckLoading}
                      className="flex-1 h-14 flex items-center justify-center gap-2 bg-white text-black hover:bg-[#F5F5F5] transition-colors disabled:opacity-50"
                    >
                      {actionLoading
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <X className="w-4 h-4" />
                      }
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        Reject Edit
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// Treat null/empty/whitespace as the same "no value" when checking URL change.
function normalizeNullable(v) {
  if (v == null) return ""
  return String(v).trim()
}