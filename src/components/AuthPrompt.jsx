import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function AuthPrompt({ show, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-black text-white px-6 py-3 flex items-center gap-4 shadow-lg">
        <p className="text-[11px] font-bold uppercase tracking-widest">
          Sign up to upvote — takes 20 seconds
        </p>
        <Link
          to="/register"
          className="text-[10px] font-bold uppercase tracking-widest text-black bg-white px-4 py-1.5 hover:bg-[#E5E5E5] transition-colors whitespace-nowrap"
        >
          Sign Up →
        </Link>
        <button
          onClick={() => { setVisible(false); onClose?.(); }}
          className="text-[#888] hover:text-white transition-colors text-xs ml-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
}