import { useState, useEffect } from "react";
import { ImageOff } from "lucide-react";

// App thumbnails/screenshots are user-supplied URLs pointing at Supabase
// storage. A deleted object, a renamed bucket, or a CDN hiccup makes the raw
// <img> render the browser's broken-image glyph — which, on an image-first
// gallery, is the worst thing the UI can show. This wraps every remote image so
// a load failure (or an empty src) degrades to a labeled placeholder instead.
//
// className is applied to BOTH the <img> and the fallback so the slot keeps the
// exact same size/shape either way (callers pass "w-full h-full object-cover …").
export default function AppImage({
  src,
  alt = "",
  name = "",
  className = "",
  ...rest
}) {
  const [failed, setFailed] = useState(false);

  // Reset when the source changes so a recycled component re-attempts the new
  // URL instead of staying stuck on a previous failure.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt || name || "Image unavailable"}
        className={`flex items-center justify-center bg-[#F0F0F0] text-[#AAAAAA] ${className}`}
      >
        <div className="flex flex-col items-center gap-1.5 px-3 text-center">
          <ImageOff className="w-5 h-5" strokeWidth={1.5} />
          {name ? (
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171] line-clamp-2 break-words">
              {name}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
