import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Eye, ArrowUp, Trophy, Layers } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const RANGE_DAYS = 30;

// Build a continuous 30-day date axis so the chart shows zeros for quiet days
// instead of "compressing" the time scale to only the days we have data for.
function buildDateBuckets(rangeDays) {
  const buckets = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10); // YYYY-MM-DD
    buckets.push({
      date: iso,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      views: 0,
      upvotes: 0,
    });
  }
  return buckets;
}

function toIsoDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function formatCount(n) {
  if (n == null) return "0";
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return Math.round(n / 1000) + "k";
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E5E5E5] px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
      <p className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA]">
        {label}
      </p>
      {payload.map((p) => (
        <p
          key={p.dataKey}
          className="text-[10px] font-bold uppercase tracking-widest text-black mt-1"
        >
          <span className="text-[#717171]">{p.dataKey}:</span> {p.value}
        </p>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sparkline (tiny per-app trend)
// ─────────────────────────────────────────────────────────────────────────────

function Sparkline({ data }) {
  const hasData = data.some((d) => d.views > 0);
  if (!hasData) {
    return (
      <div className="h-10 flex items-center">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#CCCCCC]">
          No traffic yet
        </span>
      </div>
    );
  }
  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
          <Line
            type="monotone"
            dataKey="views"
            stroke="#000"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate card
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, sublabel, icon: Icon }) {
  return (
    <div className="border border-[#E5E5E5] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
          {label}
        </p>
        {Icon && <Icon className="w-3.5 h-3.5 text-[#AAAAAA]" />}
      </div>
      <p
        className="text-[clamp(2rem,5vw,3rem)] font-black uppercase leading-none text-black"
        style={{ letterSpacing: "-0.04em" }}
      >
        {value}
      </p>
      {sublabel && (
        <p className="text-[10px] text-[#717171] truncate">{sublabel}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

export default function AnalyticsPanel({ submissions }) {
  const approvedApps = useMemo(
    () => submissions.filter((s) => s.status === "approved"),
    [submissions]
  );
  const approvedIds = useMemo(() => approvedApps.map((a) => a.id), [approvedApps]);

  // Aggregate stats derived from the apps row (cheap, no extra fetch).
  const totals = useMemo(() => {
    const totalViews = approvedApps.reduce((s, a) => s + (a.views || 0), 0);
    const totalUpvotes = approvedApps.reduce((s, a) => s + (a.upvotes || 0), 0);
    const best = approvedApps.reduce(
      (best, a) => ((a.views || 0) > (best?.views || 0) ? a : best),
      null
    );
    return { totalViews, totalUpvotes, count: approvedApps.length, best };
  }, [approvedApps]);

  const [loading, setLoading] = useState(false);
  const [dailyViews, setDailyViews] = useState([]);
  const [upvoteEvents, setUpvoteEvents] = useState([]);

  useEffect(() => {
    if (approvedIds.length === 0) {
      setDailyViews([]);
      setUpvoteEvents([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (RANGE_DAYS - 1));
    const sinceIso = since.toISOString();
    const sinceDate = sinceIso.slice(0, 10);

    (async () => {
      const [viewsRes, upvotesRes] = await Promise.all([
        supabase
          .from("app_views_daily")
          .select("app_id, day, views")
          .in("app_id", approvedIds)
          .gte("day", sinceDate),
        supabase
          .from("upvotes")
          .select("app_id, created_at")
          .in("app_id", approvedIds)
          .gte("created_at", sinceIso),
      ]);

      if (cancelled) return;
      setDailyViews(viewsRes.data || []);
      setUpvoteEvents(upvotesRes.data || []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [approvedIds]);

  // 30-day timeseries: views + upvotes summed across all approved apps.
  const timeseries = useMemo(() => {
    const buckets = buildDateBuckets(RANGE_DAYS);
    const idx = new Map(buckets.map((b, i) => [b.date, i]));
    for (const row of dailyViews) {
      const i = idx.get(row.day);
      if (i != null) buckets[i].views += row.views || 0;
    }
    for (const ev of upvoteEvents) {
      const d = toIsoDate(ev.created_at);
      const i = idx.get(d);
      if (i != null) buckets[i].upvotes += 1;
    }
    return buckets;
  }, [dailyViews, upvoteEvents]);

  // Per-app sparkline data (last 7 days).
  const perAppSparklines = useMemo(() => {
    const map = new Map();
    for (const id of approvedIds) {
      const buckets = buildDateBuckets(7);
      const idx = new Map(buckets.map((b, i) => [b.date, i]));
      map.set(id, { buckets, idx });
    }
    for (const row of dailyViews) {
      const slot = map.get(row.app_id);
      if (!slot) continue;
      const i = slot.idx.get(row.day);
      if (i != null) slot.buckets[i].views += row.views || 0;
    }
    return map;
  }, [approvedIds, dailyViews]);

  // Sort apps by views desc for the performance table.
  const rankedApps = useMemo(
    () => [...approvedApps].sort((a, b) => (b.views || 0) - (a.views || 0)),
    [approvedApps]
  );

  // The aggregate cards read lifetime counters on the apps row, but the
  // time-series charts read the day-level tables (app_views_daily / upvotes),
  // which only start filling once tracking is live. When a lifetime total
  // exists but there's no day-level history yet, the chart is legitimately
  // flat — surface a note so a big total over an empty chart doesn't read as a
  // bug.
  const noDailyHistory =
    !loading && dailyViews.length === 0 && totals.totalViews > 0;
  const noUpvoteHistory =
    !loading && upvoteEvents.length === 0 && totals.totalUpvotes > 0;

  // ───────────────── Empty state ─────────────────
  if (approvedApps.length === 0) {
    return (
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
          No Analytics Yet
        </h2>
        <p className="mt-4 text-sm text-[#717171] max-w-sm leading-relaxed">
          Once an app is approved and starts getting views, you'll see traffic,
          upvotes and per-app trends here.
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
    );
  }

  return (
    <div className="space-y-8">
      {/* Aggregate cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Views"
          value={formatCount(totals.totalViews)}
          sublabel="All approved apps"
          icon={Eye}
        />
        <StatCard
          label="Total Upvotes"
          value={formatCount(totals.totalUpvotes)}
          sublabel="All approved apps"
          icon={ArrowUp}
        />
        <StatCard
          label="Approved"
          value={totals.count}
          sublabel="Live in the gallery"
          icon={Layers}
        />
        <StatCard
          label="Top App"
          value={formatCount(totals.best?.views || 0)}
          sublabel={totals.best?.title || "—"}
          icon={Trophy}
        />
      </div>

      {/* Views over time */}
      <div className="border border-[#E5E5E5]">
        <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-black">
            Views — Last 30 Days
          </h3>
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#AAAAAA]" />
          ) : noDailyHistory ? (
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA]">
              Lifetime total above · daily history starts now
            </span>
          ) : null}
        </div>
        <div className="p-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={timeseries}
              margin={{ top: 12, right: 16, bottom: 0, left: -16 }}
            >
              <defs>
                <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#000" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#000" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#F0F0F0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "#AAAAAA" }}
                tickLine={false}
                axisLine={{ stroke: "#E5E5E5" }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 9, fill: "#AAAAAA" }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: "#E5E5E5", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="views"
                stroke="#000"
                strokeWidth={2}
                fill="url(#viewsFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Upvotes over time */}
      <div className="border border-[#E5E5E5]">
        <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-black">
            Upvotes — Last 30 Days
          </h3>
          {noUpvoteHistory && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA]">
              Lifetime total above · daily history starts now
            </span>
          )}
        </div>
        <div className="p-4 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={timeseries}
              margin={{ top: 12, right: 16, bottom: 0, left: -16 }}
            >
              <CartesianGrid stroke="#F0F0F0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "#AAAAAA" }}
                tickLine={false}
                axisLine={{ stroke: "#E5E5E5" }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 9, fill: "#AAAAAA" }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: "#F5F5F5" }}
              />
              <Bar
                dataKey="upvotes"
                fill="#000"
                radius={0}
                maxBarSize={14}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-app performance */}
      <div className="border border-[#E5E5E5]">
        <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-black">
            Per-App Performance
          </h3>
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA]">
            Sorted by views
          </span>
        </div>

        {/* Header row — desktop only */}
        <div className="hidden md:grid grid-cols-[1fr_120px_120px_180px] px-6 py-3 border-b border-[#E5E5E5] bg-[#FAFAFA]">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA]">App</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA] text-right">Views</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA] text-right">Upvotes</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA] text-right">7-day Trend</span>
        </div>

        <div className="divide-y divide-[#E5E5E5]">
          {rankedApps.map((app) => {
            const slot = perAppSparklines.get(app.id);
            return (
              <div
                key={app.id}
                className="px-6 py-4 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_120px_120px_180px] gap-4 items-center"
              >
                {/* App identity */}
                <Link
                  to={`/app/${app.id}`}
                  className="flex items-center gap-3 group min-w-0"
                >
                  <div className="w-10 h-10 flex-shrink-0 bg-[#F0F0F0] border border-[#E5E5E5] overflow-hidden">
                    {app.thumbnail_url ? (
                      <img
                        src={app.thumbnail_url}
                        alt={app.title}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-tight text-black truncate group-hover:underline underline-offset-4">
                      {app.title}
                    </p>
                    <p className="text-[10px] text-[#AAAAAA] truncate md:hidden">
                      {formatCount(app.views || 0)} views · {formatCount(app.upvotes || 0)} upvotes
                    </p>
                  </div>
                </Link>

                {/* Views — desktop */}
                <p className="hidden md:block text-right text-sm font-black uppercase tracking-tight text-black">
                  {formatCount(app.views || 0)}
                </p>

                {/* Upvotes — desktop */}
                <p className="hidden md:block text-right text-sm font-black uppercase tracking-tight text-black">
                  {formatCount(app.upvotes || 0)}
                </p>

                {/* Sparkline */}
                <div className="w-24 md:w-full">
                  {slot ? <Sparkline data={slot.buckets} /> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
