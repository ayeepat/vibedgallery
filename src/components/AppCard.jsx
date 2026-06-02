import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import AuthPrompt from "@/components/AuthPrompt";

function AppVisual({ app, size = "normal" }) {
  const h = size === "small" ? "h-40" : "h-56";
  return (
    <div
      className={`w-full ${h} relative overflow-hidden`}
      style={{ background: app.color }}
    >
      {/* Grid lines */}
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `linear-gradient(${app.accent}33 1px, transparent 1px), linear-gradient(90deg, ${app.accent}33 1px, transparent 1px)`,
          backgroundSize: "24px 24px"
        }}
      />
      {/* Central orb */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl opacity-30"
        style={{ width: 80, height: 80, background: app.accent }}
      />
      {/* Corner accent */}
      <div
        className="absolute bottom-4 right-4 w-6 h-6"
        style={{ background: app.accent, opacity: 0.8 }}
      />
      {/* Tool badge */}
      <div className="absolute top-3 left-3">
        <span
          className="text-[8px] font-bold uppercase tracking-widest px-2 py-1"
          style={{ color: app.accent, border: `1px solid ${app.accent}55`, background: `${app.accent}11` }}
        >
          {app.tool}
        </span>
      </div>
    </div>
  );
}

export default function AppCard({ app, size = "normal" }) {
  const { isAuthenticated } = useAuth();
  const [hovered, setHovered] = useState(false);
  const [upvoted, setUpvoted] = useState(false);
  const [count, setCount] = useState(app.upvotes);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const handleUpvote = (e) => {
    e.stopPropagation();
    e.preventDefault();

    // Check auth first
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      return;
    }

    // Actual upvote logic
    if (!upvoted) {
      setCount(c => c + 1);
      setUpvoted(true);
    } else {
      setCount(c => c - 1);
      setUpvoted(false);
    }
  };

  return (
    <>
      <a
        href={app.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative overflow-hidden bg-white cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <AppVisual app={app} size={size} />

        {/* Hover overlay */}
        <div
          className="absolute inset-0 bg-white flex flex-col justify-end p-4 border-t border-[#E5E5E5]"
          style={{
            transform: hovered ? "translateY(0)" : "translateY(100%)",
            transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div className="mb-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171] border border-[#E5E5E5] px-2 py-0.5">
              {app.category}
            </span>
          </div>
          <h3 className="text-sm font-black uppercase tracking-tight text-black leading-none mb-1">
            {app.name}
          </h3>
          <p className="text-[11px] text-[#717171] leading-snug mb-3">{app.tagline}</p>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#AFAFAF]">
              {app.tool}
            </span>
            <button
              onClick={handleUpvote}
              className={`flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-widest border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-black ${
                upvoted
                  ? "bg-black text-white border-black"
                  : "bg-white text-black border-[#E5E5E5] hover:border-black"
              }`}
            >
              ↑ {count}
            </button>
          </div>
        </div>
      </a>

      {/* Auth prompt toast */}
      <AuthPrompt
        show={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
      />
    </>
  );
}