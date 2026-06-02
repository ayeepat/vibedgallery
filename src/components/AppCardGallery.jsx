import { useState } from "react";

export default function AppCardGallery({ app }) {
  const [upvoted, setUpvoted] = useState(false);
  const [count, setCount] = useState(app.upvotes);

  const handleUpvote = (e) => {
    e.stopPropagation();
    if (!upvoted) {
      setCount((c) => c + 1);
      setUpvoted(true);
    }
  };

  return (
    <div
      className="relative group cursor-pointer overflow-hidden bg-[#F0F0F0] aspect-[4/5]"
      onClick={() => window.open(app.url, "_blank")}
    >
      {/* Placeholder visual — stylized mock screenshot */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: app.color }}
      >
        {/* Abstract grid lines */}
        <div className="absolute inset-0 opacity-10">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute border-t border-white"
              style={{ top: `${(i + 1) * 12.5}%`, left: 0, right: 0 }}
            />
          ))}
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute border-l border-white"
              style={{ left: `${(i + 1) * 16.66}%`, top: 0, bottom: 0 }}
            />
          ))}
        </div>
        {/* Accent circle */}
        <div
          className="w-16 h-16 rounded-full opacity-60"
          style={{ background: app.accent, filter: "blur(24px)" }}
        />
        {/* App initial */}
        <span
          className="relative text-3xl font-black uppercase tracking-tighter"
          style={{ color: app.accent, mixBlendMode: "screen" }}
        >
          {app.name[0]}
        </span>
      </div>

      {/* Hover overlay — slides up */}
      <div
        className="absolute inset-x-0 bottom-0 bg-white border-t border-[#E5E5E5] p-4 translate-y-full group-hover:translate-y-0"
        style={{ transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1)" }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-tight text-black truncate">
              {app.name}
            </p>
            <p className="text-[10px] text-[#717171] mt-0.5 leading-snug line-clamp-2">
              {app.tagline}
            </p>
          </div>
          <button
            onClick={handleUpvote}
            className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-2 py-1 border focus-visible:outline focus-visible:outline-2 focus-visible:outline-black transition-colors ${
              upvoted
                ? "border-black bg-black text-white"
                : "border-[#E5E5E5] text-black hover:border-black"
            }`}
          >
            <span className="text-[10px] leading-none">▲</span>
            <span className="text-[10px] font-bold leading-none">{count}</span>
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171] border border-[#E5E5E5] px-1.5 py-0.5">
            {app.category}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
            {app.tool}
          </span>
        </div>
      </div>
    </div>
  );
}