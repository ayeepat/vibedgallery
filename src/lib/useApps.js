import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

// Page size for the gallery's server-paginated listings.
export const GALLERY_PAGE_SIZE = 24

// Explicit column list for SELECTs on public.apps.
// `submitter_email` is intentionally OMITTED — that column is locked down at
// the DB layer (anon and authenticated have no SELECT privilege on it). If we
// used `select('*')`, PostgREST would generate a query referencing every
// column and PostgreSQL would reject the request with "permission denied".
// Admins fetch the email separately via the get_app_submitter_email RPC.
//
// Full column set — used by the admin queue and by owners viewing their OWN
// submissions (Profile). It includes review-pipeline internals
// (verification_token, safe_browsing_*, reviewed_by, rejection_reason, …).
export const APP_SELECT_COLUMNS =
  'id, user_id, title, tagline, description, url, category, tags, ' +
  'primary_tool, other_tools, demo_video_url, thumbnail_url, screenshot_urls, ' +
  'verification_token, ownership_verified, ' +
  'safe_browsing_passed, safe_browsing_threats, thumbnail_flagged, ' +
  'status, rejection_reason, reviewed_by, reviewed_at, ' +
  'submitter_twitter, submitter_github, ' +
  'upvotes, views, created_at, updated_at'

// Lean column set for PUBLIC reads (gallery, app detail, maker pages). It
// returns only what those views render. This (a) shrinks the payload sent to
// every anonymous visitor and (b) avoids exposing review-pipeline internals
// (verification_token, safe_browsing_threats, rejection_reason, reviewed_by,
// status) to anyone who can read an approved row.
export const APP_PUBLIC_COLUMNS =
  'id, user_id, title, tagline, description, url, category, tags, ' +
  'primary_tool, other_tools, demo_video_url, ' +
  'thumbnail_url, screenshot_urls, ' +
  'submitter_twitter, submitter_github, ' +
  'ownership_verified, upvotes, views, created_at'

// Normalize a Supabase apps row to the shape the UI was built for.
function normalizeApp(row) {
  if (!row) return null
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.title,
    tagline: row.tagline,
    description: row.description,
    category: row.category,
    tool: row.primary_tool,
    other_tools: row.other_tools,
    tags: row.tags || [],
    upvotes: row.upvotes ?? 0,
    views: row.views ?? 0,
    url: row.url,
    image: row.thumbnail_url,
    screenshots: row.screenshot_urls || [],
    demo_video_url: row.demo_video_url,
    submitter_twitter: row.submitter_twitter,
    submitter_github: row.submitter_github,
    ownership_verified: row.ownership_verified === true,
    created_at: row.created_at,
    status: row.status,
  }
}

// All approved apps, newest first. Single-shot — used by surfaces that need
// the full list at once (homepage Trending strip, etc.). The gallery uses
// `useApprovedAppsInfinite` instead so the payload scales.
export function useApprovedApps() {
  return useQuery({
    queryKey: ['apps', 'approved'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apps')
        .select(APP_PUBLIC_COLUMNS)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(GALLERY_PAGE_SIZE * 4)
      if (error) throw error
      return (data || []).map(normalizeApp)
    },
    staleTime: 30_000,
  })
}

// Server-paginated gallery listing. `sort` is "Newest" | "Trending" and
// `category` is either a category string or null for all.
export function useApprovedAppsInfinite({ sort = 'Newest', category = null } = {}) {
  return useInfiniteQuery({
    queryKey: ['apps', 'approved', 'infinite', sort, category || 'all'],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * GALLERY_PAGE_SIZE
      const to = from + GALLERY_PAGE_SIZE - 1

      let query = supabase
        .from('apps')
        .select(APP_PUBLIC_COLUMNS, { count: 'exact' })
        .eq('status', 'approved')

      if (category) query = query.eq('category', category)

      if (sort === 'Trending') {
        // Tie-break trending on created_at so order is stable across pages.
        query = query
          .order('upvotes', { ascending: false })
          .order('created_at', { ascending: false })
      } else if (sort === 'Most Viewed') {
        query = query
          .order('views', { ascending: false })
          .order('created_at', { ascending: false })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      const { data, error, count } = await query.range(from, to)
      if (error) throw error
      return {
        rows: (data || []).map(normalizeApp),
        page: pageParam,
        total: count ?? null,
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loaded = (lastPage.page + 1) * GALLERY_PAGE_SIZE
      if (lastPage.total != null && loaded >= lastPage.total) return undefined
      if (lastPage.rows.length < GALLERY_PAGE_SIZE) return undefined
      return lastPage.page + 1
    },
    staleTime: 30_000,
  })
}

// Single approved app by id (uuid string).
export function useApp(id) {
  return useQuery({
    queryKey: ['app', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apps')
        .select(APP_PUBLIC_COLUMNS)
        .eq('id', id)
        .single()
      if (error) throw error
      return normalizeApp(data)
    },
    enabled: !!id,
  })
}

// All approved apps for a given maker (user_id), newest first.
export function useApprovedAppsByMaker(userId) {
  return useQuery({
    queryKey: ['apps', 'maker', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apps')
        .select(APP_PUBLIC_COLUMNS)
        .eq('status', 'approved')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []).map(normalizeApp)
    },
    enabled: !!userId,
    staleTime: 30_000,
  })
}

// Public profile lookup. Reads from the public_profiles view so anonymous
// visitors can resolve maker info without seeing private fields like email.
export function useMaker(userId) {
  return useQuery({
    queryKey: ['maker', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('public_profiles')
        .select('id, name, avatar_url, created_at')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!userId,
    staleTime: 60_000,
  })
}
