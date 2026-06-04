export function SkeletonBox({ className = "" }) {
  return (
    <div
      className={`bg-[#F0F0F0] relative overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export function SubmissionCardSkeleton() {
  return (
    <div className="border border-[#E5E5E5] flex flex-col">
      <SkeletonBox className="w-full aspect-video border-b border-[#E5E5E5]" />
      <div className="px-4 py-3 border-b border-[#E5E5E5] space-y-2">
        <SkeletonBox className="h-4 w-3/4" />
        <SkeletonBox className="h-3 w-1/3" />
      </div>
      <SkeletonBox className="h-10 w-full" />
    </div>
  );
}

export function GalleryCardSkeleton() {
  return (
    <div>
      <SkeletonBox className="w-full aspect-video" />
      <div className="mt-2 space-y-2">
        <SkeletonBox className="h-4 w-2/3" />
        <SkeletonBox className="h-3 w-1/2" />
      </div>
    </div>
  );
}
