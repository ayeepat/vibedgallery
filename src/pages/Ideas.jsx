import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ArrowBigUp, MessageCircle, Lightbulb, Send } from "lucide-react";
import Nav from "@/components/Nav";
import { useAuth } from "@/lib/AuthContext";
import { usePageMeta } from "@/lib/usePageMeta";
import { toast } from "@/components/ui/use-toast";
import {
  useIdeaRequests,
  useIdeaReplies,
  useMyIdeaVotes,
  usePostIdea,
  usePostReply,
  useToggleIdeaVote,
} from "@/lib/useIdeas";

const MAX_BODY = 2000;
const PRESET_REPLY = "Sure — I can build this. Drop me a line!";

function timeAgo(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

function authorLabel(req) {
  return req.authorName?.trim() || (req.authorUsername ? `@${req.authorUsername}` : "Someone");
}

// ─── Compose box (the ONLY place to submit a request) ──────────────
function Composer({ userId }) {
  const [body, setBody] = useState("");
  const post = usePostIdea(userId);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (trimmed.length < 3) return;
    try {
      await post.mutateAsync(trimmed);
      setBody("");
      toast({ title: "Posted", description: "Your idea is live on the board." });
    } catch (err) {
      toast({
        title: "Couldn't post",
        description: err?.message || "Try again in a moment.",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={submit} className="border border-[#E5E5E5]">
      <div className="px-4 py-3 border-b border-[#E5E5E5] bg-[#F5F5F5] flex items-center gap-2">
        <Lightbulb className="w-3.5 h-3.5 text-black" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
          I wish this existed…
        </span>
      </div>
      <textarea
        value={body}
        maxLength={MAX_BODY}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Describe the app or feature you wish someone would build."
        className="w-full px-4 py-3 text-sm text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none resize-none"
      />
      <div className="px-4 py-2 border-t border-[#E5E5E5] flex items-center justify-between">
        <span className="text-[9px] text-[#AAAAAA]">{body.length}/{MAX_BODY}</span>
        <button
          type="submit"
          disabled={post.isPending || body.trim().length < 3}
          className="h-8 px-5 flex items-center gap-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {post.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Post Idea
        </button>
      </div>
    </form>
  );
}

// ─── Reply thread for one request ──────────────────────────────────
function ReplyThread({ requestId, userId }) {
  const { data: replies, isLoading } = useIdeaReplies(requestId);
  const [body, setBody] = useState("");
  const postReply = usePostReply(userId);

  const send = async (text) => {
    const trimmed = (text ?? body).trim();
    if (!trimmed) return;
    try {
      await postReply.mutateAsync({ requestId, body: trimmed });
      setBody("");
    } catch (err) {
      toast({
        title: "Couldn't reply",
        description: err?.message || "Try again in a moment.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="border-t border-[#E5E5E5] bg-[#FAFAFA]">
      {isLoading ? (
        <div className="px-4 py-4 flex items-center gap-2 text-[#AAAAAA]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Loading replies…</span>
        </div>
      ) : (
        <>
          {replies?.length > 0 ? (
            <div className="divide-y divide-[#E5E5E5]">
              {replies.map((r) => (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-black">
                      {r.user_id ? (
                        <Link to={`/maker/${r.user_id}`} className="hover:underline">
                          {r.authorName?.trim() || (r.authorUsername ? `@${r.authorUsername}` : "Someone")}
                        </Link>
                      ) : "Someone"}
                    </span>
                    <span className="text-[9px] text-[#AAAAAA]">{timeAgo(r.created_at)}</span>
                  </div>
                  <p className="text-sm text-[#333] whitespace-pre-wrap break-words leading-relaxed">{r.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 text-[11px] text-[#AAAAAA]">No replies yet — be the first to say you'll build it.</p>
          )}

          {/* Reply composer */}
          {userId ? (
            <div className="px-4 py-3 border-t border-[#E5E5E5] space-y-2">
              <button
                type="button"
                onClick={() => send(PRESET_REPLY)}
                disabled={postReply.isPending}
                className="h-7 px-3 flex items-center gap-1.5 border border-black text-[9px] font-bold uppercase tracking-widest text-black hover:bg-black hover:text-white transition-colors disabled:opacity-40"
              >
                👍 Sure, I'll build this
              </button>
              <div className="flex items-end gap-2">
                <textarea
                  value={body}
                  maxLength={MAX_BODY}
                  onChange={(e) => setBody(e.target.value)}
                  rows={1}
                  placeholder="Write a reply…"
                  className="flex-1 px-3 py-2 text-sm text-black bg-white border border-[#E5E5E5] placeholder:text-[#AAAAAA] focus:outline-none focus:border-black resize-none"
                />
                <button
                  type="button"
                  onClick={() => send()}
                  disabled={postReply.isPending || !body.trim()}
                  className="h-9 px-4 flex items-center gap-1.5 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {postReply.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                </button>
              </div>
            </div>
          ) : (
            <p className="px-4 py-3 border-t border-[#E5E5E5] text-[10px] font-bold uppercase tracking-widest text-[#717171]">
              <Link to="/login" className="underline">Sign in</Link> to reply
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Single request card ───────────────────────────────────────────
function RequestCard({ req, userId, myVotes, onVote }) {
  const [open, setOpen] = useState(false);
  const voted = myVotes?.has(req.id) ?? false;

  return (
    <div className="border border-[#E5E5E5] bg-white">
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-black">
            {req.user_id ? (
              <Link to={`/maker/${req.user_id}`} className="hover:underline">{authorLabel(req)}</Link>
            ) : authorLabel(req)}
          </span>
          <span className="text-[9px] text-[#AAAAAA]">{timeAgo(req.created_at)}</span>
        </div>
        <p className="text-sm text-black whitespace-pre-wrap break-words leading-relaxed">{req.body}</p>
      </div>

      <div className="px-4 py-2 border-t border-[#E5E5E5] flex items-center gap-2">
        <button
          type="button"
          onClick={() => onVote(req, voted)}
          className={`h-7 px-3 flex items-center gap-1.5 border text-[9px] font-bold uppercase tracking-widest transition-colors ${
            voted
              ? "bg-black text-white border-black"
              : "border-[#E5E5E5] text-[#717171] hover:border-black hover:text-black"
          }`}
        >
          <ArrowBigUp className="w-3.5 h-3.5" />
          Me too · {req.voteCount}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="h-7 px-3 flex items-center gap-1.5 border border-[#E5E5E5] text-[9px] font-bold uppercase tracking-widest text-[#717171] hover:border-black hover:text-black transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {req.replyCount} {req.replyCount === 1 ? "Reply" : "Replies"}
        </button>
      </div>

      {open && <ReplyThread requestId={req.id} userId={userId} />}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────
export default function Ideas() {
  const { user, isAuthenticated } = useAuth();
  usePageMeta({
    title: "Idea Requests",
    description: "Post the app you wish existed. Makers reply and build it. A public wishlist for the VibedGallery community.",
    path: "/ideas",
  });

  const [sort, setSort] = useState("newest");

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useIdeaRequests();
  const { data: myVotes } = useMyIdeaVotes(user?.id);
  const toggleVote = useToggleIdeaVote(user?.id);

  const total = data?.pages?.[0]?.total ?? null;

  // Server returns newest-first. "Top" re-ranks the loaded set by vote count
  // (tie-break newest) on the client — fine at this volume.
  const requests = useMemo(() => {
    const rows = data?.pages.flatMap((p) => p.rows) ?? [];
    if (sort !== "top") return rows;
    return [...rows].sort(
      (a, b) =>
        b.voteCount - a.voteCount ||
        new Date(b.created_at) - new Date(a.created_at)
    );
  }, [data, sort]);

  const handleVote = (req, voted) => {
    if (!isAuthenticated) {
      toast({ title: "Sign in to vote", description: "You need an account to say “me too”." });
      return;
    }
    toggleVote.mutate({ requestId: req.id, voted });
  };

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <div className="pt-14">
        {/* Header */}
        <div className="border-b border-[#E5E5E5] px-6 md:px-8 py-10">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171]">Beta · Community Wishlist</p>
            <span className="text-[8px] font-bold uppercase tracking-widest text-white bg-black px-1.5 py-0.5">New</span>
          </div>
          <h1 className="text-[clamp(2rem,5vw,4rem)] font-black uppercase leading-none" style={{ letterSpacing: "-0.04em" }}>
            I WISH THIS<br />EXISTED.
          </h1>
          <p className="text-sm text-[#717171] mt-5 max-w-xl leading-relaxed">
            Post an app or feature you wish someone would build — no idea is too small.
            Makers browse the board and reply <span className="font-bold text-black">“sure, I'll build this”</span> when
            they want to take it on. Hit <span className="font-bold text-black">Me too</span> on ideas you'd use so the
            best ones rise to the top. Posts go live instantly — no approval needed.
          </p>
        </div>

        <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-10">
          {/* ── 1 · POST AN IDEA (the action) ─────────────────────────── */}
          <section>
            <div className="flex items-baseline gap-2 mb-3">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-black">Post an idea</h2>
              <span className="text-[10px] text-[#AAAAAA]">— the app you wish existed</span>
            </div>
            {isAuthenticated ? (
              <Composer userId={user.id} />
            ) : (
              <div className="border border-[#E5E5E5] px-4 py-5 text-center">
                <p className="text-sm text-[#717171] mb-3">Sign in to post an idea or reply to one.</p>
                <Link
                  to="/login"
                  className="inline-flex h-9 px-6 items-center bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors"
                >
                  Sign In
                </Link>
              </div>
            )}
          </section>

          {/* ── 2 · THE BOARD (existing posts) ────────────────────────── */}
          <section>
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3 mb-5">
              <div className="flex items-baseline gap-2">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-black">Community ideas</h2>
                {total != null && (
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171] bg-[#F5F5F5] border border-[#E5E5E5] px-1.5 py-0.5">
                    {total}
                  </span>
                )}
              </div>
              {requests.length > 1 && (
                <div className="flex border border-[#E5E5E5]">
                  {["newest", "top"].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSort(key)}
                      className={`h-7 px-3 text-[9px] font-bold uppercase tracking-widest transition-colors ${
                        sort === key
                          ? "bg-black text-white"
                          : "text-[#717171] hover:text-black"
                      }`}
                    >
                      {key === "newest" ? "Newest" : "Top"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-[#717171]" />
              </div>
            ) : isError ? (
              <p className="text-center text-sm text-[#717171] py-16">Couldn't load ideas. Refresh to try again.</p>
            ) : requests.length === 0 ? (
              <div className="border border-dashed border-[#E5E5E5] px-4 py-16 text-center">
                <Lightbulb className="w-6 h-6 text-[#AAAAAA] mx-auto mb-3" />
                <p className="text-sm text-[#717171]">No ideas yet. Be the first to wish something into existence.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((req) => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    userId={user?.id}
                    myVotes={myVotes}
                    onVote={handleVote}
                  />
                ))}
              </div>
            )}

            {hasNextPage && (
              <div className="flex justify-center pt-6">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="h-9 px-6 flex items-center gap-2 border border-[#E5E5E5] text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:border-black hover:text-black transition-colors disabled:opacity-50"
                >
                  {isFetchingNextPage && <Loader2 className="w-3 h-3 animate-spin" />}
                  Load more
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="h-12 border-t border-[#E5E5E5] flex items-center px-6 md:px-8 justify-between">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">VibedGallery © 2025</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">Apps built with AI, shared by their makers.</span>
      </div>
    </div>
  );
}
