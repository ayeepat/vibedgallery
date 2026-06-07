import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { sanitizeSearchTerm } from '@/lib/urlHelpers'

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
  'verification_token, ownership_verified, slug, ' +
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
  'thumbnail_url, screenshot_urls, slug, ' +
  'submitter_twitter, submitter_github, ' +
  'ownership_verified, upvotes, views, created_at'

// PostgREST embed that pulls the maker's handle alongside an apps row. We embed
// the public_profiles VIEW (not profiles) because anon is RLS-blocked from
// reading profiles directly — embedding profiles returns null for logged-out
// visitors. PostgREST resolves apps -> public_profiles via the
// apps.user_id -> profiles.id FK (apps_user_id_profiles_fkey) that backs the
// view. Lets the gallery build pretty /<username>/<slug> links in one round-trip.
export const MAKER_EMBED = 'maker:public_profiles(username)'

// APP_PUBLIC_COLUMNS plus the embedded maker handle — the standard select for
// public surfaces that render app cards/links.
export const APP_PUBLIC_SELECT = `${APP_PUBLIC_COLUMNS}, ${MAKER_EMBED}`

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
    // Pretty-URL parts. `username` comes from the embedded maker (or a flat
    // `username` column when a caller already joined it); both feed appPath().
    slug: row.slug ?? null,
    username: row.maker?.username ?? row.username ?? null,
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
        .select(APP_PUBLIC_SELECT)
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
// `category` is either a category string or null for all. `q` is an optional
// free-text query matched against title/tagline/category/primary_tool.
export function useApprovedAppsInfinite({ sort = 'Newest', category = null, q = '' } = {}) {
  // Strip PostgREST `or()` / SQL-LIKE meta chars so the filter can't break or
  // be coerced into another column, and bound the length.
  const term = sanitizeSearchTerm(q)

  return useInfiniteQuery({
    queryKey: ['apps', 'approved', 'infinite', sort, category || 'all', term || 'noq'],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * GALLERY_PAGE_SIZE
      const to = from + GALLERY_PAGE_SIZE - 1

      let query = supabase
        .from('apps')
        .select(APP_PUBLIC_SELECT, { count: 'exact' })
        .eq('status', 'approved')

      if (category) query = query.eq('category', category)

      if (term) {
        const pattern = `%${term}%`
        query = query.or(
          [
            `title.ilike.${pattern}`,
            `tagline.ilike.${pattern}`,
            `category.ilike.${pattern}`,
            `primary_tool.ilike.${pattern}`,
          ].join(',')
        )
      }

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

// Single approved app by id (uuid string). Still used by the legacy /app/:id
// route, which redirects to the pretty URL once this resolves the maker handle.
export function useApp(id) {
  return useQuery({
    queryKey: ['app', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apps')
        .select(APP_PUBLIC_SELECT)
        .eq('id', id)
        .single()
      if (error) throw error
      return normalizeApp(data)
    },
    enabled: !!id,
  })
}

// Single approved app by its pretty URL parts: /<username>/<slug>. Slugs are
// only unique per maker, so we must match BOTH segments — an inner join on the
// maker handle (globally unique) pins it to exactly one row. Username/slug are
// lowercased to match the canonical stored form regardless of link casing.
export function useAppByHandle(username, slug) {
  const u = (username || '').toLowerCase()
  const s = (slug || '').toLowerCase()
  return useQuery({
    queryKey: ['app', 'handle', u, s],
    queryFn: async () => {
      // No explicit status filter — RLS governs visibility (anon sees only
      // approved rows; an owner/admin can resolve their own pending app), which
      // keeps the legacy /app/:id -> pretty-URL redirect valid in every case.
      // (username, slug) is globally unique, so maybeSingle() is safe.
      const { data, error } = await supabase
        .from('apps')
        .select(`${APP_PUBLIC_COLUMNS}, maker:public_profiles!inner(username)`)
        .eq('slug', s)
        .eq('maker.username', u)
        .maybeSingle()
      if (error) throw error
      return data ? normalizeApp(data) : null
    },
    enabled: !!u && !!s,
  })
}

// All approved apps for a given maker (user_id), newest first.
export function useApprovedAppsByMaker(userId) {
  return useQuery({
    queryKey: ['apps', 'maker', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apps')
        .select(APP_PUBLIC_SELECT)
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

// All approved apps that carry a given tag, newest first. `tag` is matched
// against the `tags` text[] column with .contains() so the filter happens
// server-side and the lookup is index-friendly. Case-sensitive by design —
// callers should pass the normalized tag (the one rendered on the chip).
export function useAppsByTag(tag) {
  return useQuery({
    queryKey: ['apps', 'tag', tag],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apps')
        .select(APP_PUBLIC_SELECT)
        .eq('status', 'approved')
        .contains('tags', [tag])
        .order('created_at', { ascending: false })
        .limit(GALLERY_PAGE_SIZE * 4)
      if (error) throw error
      return (data || []).map(normalizeApp)
    },
    enabled: !!tag,
    staleTime: 30_000,
  })
}

// Apps the signed-in user has bookmarked. We fetch the bookmark rows then
// hydrate them with the joined apps row in a single query. We only surface
// bookmarks whose underlying app is currently approved — apps that were
// removed or never approved should not render dead cards in the Saved tab.
export function useBookmarkedApps(userId) {
  return useQuery({
    queryKey: ['bookmarks', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookmarks')
        .select(`created_at, apps:app_id (status, ${APP_PUBLIC_SELECT})`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || [])
        .map((row) => row.apps)
        .filter((a) => a && a.status === 'approved')
        .map(normalizeApp)
    },
    enabled: !!userId,
    staleTime: 30_000,
  })
}

// Returns whether the signed-in user has bookmarked the given app. Used by
// the bookmark button on cards / detail. The Set lookup means we hit Supabase
// once per session rather than once per card.
export function useBookmarkIds(userId) {
  return useQuery({
    queryKey: ['bookmarks', 'ids', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('app_id')
      if (error) throw error
      return new Set((data || []).map((r) => r.app_id))
    },
    enabled: !!userId,
    staleTime: 30_000,
  })
}

// Toggle a bookmark. Optimistic — flips the cached Set immediately, rolls back
// on error. Returns a mutate function whose argument is the appId to toggle.
export function useToggleBookmark(userId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ appId, currentlyBookmarked }) => {
      if (!userId) throw new Error('Not signed in')
      if (currentlyBookmarked) {
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('app_id', appId)
          .eq('user_id', userId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('bookmarks')
          .insert({ app_id: appId, user_id: userId })
        if (error) throw error
      }
    },
    onMutate: async ({ appId, currentlyBookmarked }) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks', 'ids', userId] })
      const previous = queryClient.getQueryData(['bookmarks', 'ids', userId])
      const next = new Set(previous instanceof Set ? previous : [])
      if (currentlyBookmarked) next.delete(appId)
      else next.add(appId)
      queryClient.setQueryData(['bookmarks', 'ids', userId], next)
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['bookmarks', 'ids', userId], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks', 'ids', userId] })
      queryClient.invalidateQueries({ queryKey: ['bookmarks', userId] })
    },
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
        .select('id, name, avatar_url, created_at, username')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!userId,
    staleTime: 60_000,
  })
}
