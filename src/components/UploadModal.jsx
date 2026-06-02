import { useState } from "react";

const CATEGORIES = [
  "Productivity",
  "Business",
  "Tools",
  "Creative",
  "Analytics",
  "Dev Tools",
  "Writing",
  "Audio",
  "Utilities",
];

export default function UploadModal({ open, onClose }) {
  const [dragging, setDragging] = useState(false);
  const [form, setForm] = useState({
    name: "",
    url: "",
    tagline: "",
    category: "",
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[#E5E5E5] w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-[#E5E5E5]">
          <span className="text-[10px] font-bold uppercase tracking-widest text-black">
            Deposit an Artifact
          </span>
          <button
            onClick={onClose}
            className="text-[#717171] hover:text-black text-lg leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="px-8 py-6 flex flex-col gap-4">
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-[#717171] mb-1.5">
              App Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. TaskVibe"
              className="w-full h-10 px-3 text-sm border border-[#E5E5E5] bg-white text-black placeholder:text-[#AAAAAA] focus:outline-none focus:border-black transition-colors"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-[#717171] mb-1.5">
              Live URL
            </label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://"
              className="w-full h-10 px-3 text-sm border border-[#E5E5E5] bg-white text-black placeholder:text-[#AAAAAA] focus:outline-none focus:border-black transition-colors"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-[#717171] mb-1.5">
              Tagline
            </label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              placeholder="One sentence that captures the vibe."
              className="w-full h-10 px-3 text-sm border border-[#E5E5E5] bg-white text-black placeholder:text-[#AAAAAA] focus:outline-none focus:border-black transition-colors"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-[#717171] mb-1.5">
              Category
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full h-10 px-3 text-sm border border-[#E5E5E5] bg-white text-black focus:outline-none focus:border-black transition-colors appearance-none cursor-pointer"
            >
              <option value="" disabled>
                Select a category
              </option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Drag & Drop zone */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-[#717171] mb-1.5">
              Media
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); }}
              className={`h-28 flex flex-col items-center justify-center border-2 border-dashed transition-colors cursor-pointer ${
                dragging ? "border-black bg-[#F5F5F5]" : "border-[#E5E5E5]"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#717171]">
                Drop Screenshot or GIF
              </span>
              <span className="text-[9px] text-[#AAAAAA] mt-1">
                PNG, GIF, WEBP — max 10MB
              </span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="px-8 pb-8">
          <button
            className="w-full h-12 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            onClick={onClose}
          >
            Launch
          </button>
        </div>
      </div>
    </div>
  );
}