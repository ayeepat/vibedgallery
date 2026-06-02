export default function AppCardHome({ app }) {
  return (
    <div
      className="cursor-pointer group"
      onClick={() => window.open(app.url, "_blank")}
    >
      {/* Image block */}
      <div
        className="w-full aspect-square flex items-center justify-center relative overflow-hidden"
        style={{ background: app.color }}
      >
        <div
          className="w-10 h-10 rounded-full opacity-50"
          style={{ background: app.accent, filter: "blur(16px)" }}
        />
        <span
          className="absolute text-2xl font-black uppercase"
          style={{ color: app.accent, mixBlendMode: "screen" }}
        >
          {app.name[0]}
        </span>
      </div>

      {/* Info */}
      <div className="p-3 border-t border-[#E5E5E5]">
        <p className="text-[11px] font-black uppercase tracking-tight text-black truncate group-hover:underline">
          {app.name}
        </p>
        <p className="text-[10px] text-[#717171] mt-0.5 leading-snug line-clamp-2">
          {app.tagline}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-[8px] font-bold uppercase tracking-widest text-[#717171] border border-[#E5E5E5] px-1 py-0.5">
            {app.category}
          </span>
          <span className="text-[9px] text-[#AAAAAA] font-bold">▲ {app.upvotes}</span>
        </div>
      </div>
    </div>
  );
}