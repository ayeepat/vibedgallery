import { useNavigate } from "react-router-dom";
import { Bookmark } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useBookmarkIds, useToggleBookmark } from "@/lib/useApps";
import { toast } from "@/components/ui/use-toast";

// Bookmark / save toggle. Two render variants:
//   - variant="icon"   (default) — square icon-only button (used on the gallery
//     card overlay).
//   - variant="block"  — full-width labeled button (used in the AppDetail
//     action column, sized to match the upvote/visit buttons).
//
// Signed-out users get bounced through /login?from=… with the same redirect
// pattern as upvotes, so they land back where they were after auth.
export default function BookmarkButton({
  appId,
  variant = "icon",
  className = "",
  stopPropagation = false,
}) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { data: ids } = useBookmarkIds(user?.id);
  const toggle = useToggleBookmark(user?.id);

  const bookmarked = ids instanceof Set && ids.has(appId);
  const loading = toggle.isPending;

  const onClick = (e) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!isAuthenticated) {
      navigate(`/login?from=${encodeURIComponent(`/app/${appId}`)}`);
      return;
    }
    if (loading) return;
    toggle.mutate(
      { appId, currentlyBookmarked: bookmarked },
      {
        // The hook already rolls the optimistic toggle back on error; surface
        // why it snapped back instead of leaving the user guessing.
        onError: () => {
          toast({
            title: bookmarked ? "Couldn't remove bookmark" : "Couldn't save app",
            description: "Check your connection and try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const label = bookmarked ? "Saved" : "Save";
  const ariaLabel = bookmarked ? "Remove bookmark" : "Save app";

  if (variant === "block") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        aria-pressed={bookmarked}
        aria-label={ariaLabel}
        className={`h-12 px-8 text-[10px] font-bold uppercase tracking-widest border transition-colors flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black disabled:opacity-50 disabled:cursor-not-allowed ${
          bookmarked
            ? "bg-black text-white border-black"
            : "bg-white text-black border-[#E5E5E5] hover:border-black"
        } ${className}`}
      >
        <Bookmark
          className="w-3.5 h-3.5"
          strokeWidth={2}
          fill={bookmarked ? "currentColor" : "none"}
        />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-pressed={bookmarked}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`w-8 h-8 flex items-center justify-center bg-white border border-[#E5E5E5] hover:border-black transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black ${className}`}
    >
      <Bookmark
        className={`w-3.5 h-3.5 ${bookmarked ? "text-black" : "text-[#717171]"}`}
        strokeWidth={2}
        fill={bookmarked ? "currentColor" : "none"}
      />
    </button>
  );
}
