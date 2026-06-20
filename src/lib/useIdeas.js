import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export const IDEAS_PAGE_SIZE = 20

// Author handle/name is embedded from public_profiles (anon is RLS-blocked from
// profiles directly) via the user_id -> profiles.id FK. Reply/vote counts come
// back as PostgREST aggregate embeds: `[{ count: n }]`.
const REQUEST_SELECT =
  'id, body, created_at, user_id, ' +
  'author:public_profiles(username, name), ' +
  'replies:idea_replies(count), ' +
  'votes:idea_request_votes(count)'

const REPLY_SELECT =
  'id, body, created_at, user_id, request_id, ' +
  'author:public_profiles(username, name)'

function embedCount(v) {
  return Array.isArray(v) && v[0] ? Number(v[0].count) || 0 : 0
}

function normalizeRequest(row) {
  if (!row) return null
  return {
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    user_id: row.user_id,
    authorName: row.author?.name || null,
    authorUsername: row.author?.username || null,
    replyCount: embedCount(row.replies),
    voteCount: embedCount(row.votes),
  }
}

function normalizeReply(row) {
  if (!row) return null
  return {
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    user_id: row.user_id,
    request_id: row.request_id,
    authorName: row.author?.name || null,
    authorUsername: row.author?.username || null,
  }
}

// Paginated feed of idea requests, newest first.
export function useIdeaRequests() {
  return useInfiniteQuery({
    queryKey: ['ideas', 'feed'],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * IDEAS_PAGE_SIZE
      const to = from + IDEAS_PAGE_SIZE - 1
      const { data, error, count } = await supabase
        .from('idea_requests')
        .select(REQUEST_SELECT, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      return {
        rows: (data || []).map(normalizeRequest),
        page: pageParam,
        total: count ?? null,
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loaded = (lastPage.page + 1) * IDEAS_PAGE_SIZE
      if (lastPage.total != null && loaded >= lastPage.total) return undefined
      if (lastPage.rows.length < IDEAS_PAGE_SIZE) return undefined
      return lastPage.page + 1
    },
    staleTime: 15_000,
  })
}

// Replies for one request, oldest first (conversation order).
export function useIdeaReplies(requestId, enabled = true) {
  return useQuery({
    queryKey: ['ideas', 'replies', requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('idea_replies')
        .select(REPLY_SELECT)
        .eq('request_id', requestId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data || []).map(normalizeReply)
    },
    enabled: !!requestId && enabled,
    staleTime: 15_000,
  })
}

// Set of request ids the signed-in user has "me too"'d.
export function useMyIdeaVotes(userId) {
  return useQuery({
    queryKey: ['ideas', 'myVotes', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('idea_request_votes')
        .select('request_id')
        .eq('user_id', userId)
      if (error) throw error
      return new Set((data || []).map((r) => r.request_id))
    },
    enabled: !!userId,
    staleTime: 15_000,
  })
}

export function usePostIdea(userId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase
        .from('idea_requests')
        .insert({ user_id: userId, body: body.trim() })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas', 'feed'] }),
  })
}

export function usePostReply(userId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ requestId, body }) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase
        .from('idea_replies')
        .insert({ request_id: requestId, user_id: userId, body: body.trim() })
      if (error) throw error
    },
    onSuccess: (_d, { requestId }) => {
      qc.invalidateQueries({ queryKey: ['ideas', 'replies', requestId] })
      qc.invalidateQueries({ queryKey: ['ideas', 'feed'] })
    },
  })
}

// Optimistic "me too" toggle — flips the cached Set immediately, rolls back on
// error. Vote counts in the feed refresh on settle.
export function useToggleIdeaVote(userId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ requestId, voted }) => {
      if (!userId) throw new Error('Not signed in')
      if (voted) {
        const { error } = await supabase
          .from('idea_request_votes')
          .delete()
          .eq('request_id', requestId)
          .eq('user_id', userId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('idea_request_votes')
          .insert({ request_id: requestId, user_id: userId })
        if (error) throw error
      }
    },
    onMutate: async ({ requestId, voted }) => {
      await qc.cancelQueries({ queryKey: ['ideas', 'myVotes', userId] })
      const previous = qc.getQueryData(['ideas', 'myVotes', userId])
      const next = new Set(previous instanceof Set ? previous : [])
      if (voted) next.delete(requestId)
      else next.add(requestId)
      qc.setQueryData(['ideas', 'myVotes', userId], next)
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(['ideas', 'myVotes', userId], ctx.previous)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['ideas', 'myVotes', userId] })
      qc.invalidateQueries({ queryKey: ['ideas', 'feed'] })
    },
  })
}
