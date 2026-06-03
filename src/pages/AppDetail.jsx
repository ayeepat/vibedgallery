import { useParams, Link } from "react-router-dom";
import Nav from "../components/Nav";
import { APPS } from "../data/apps";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import UploadModal from "../components/UploadModal";

export default function AppDetail() {
  const { id } = useParams();
  const app = APPS.find((a) => a.id === Number(id));
  const [uploadOpen, setUploadOpen] = useState(false);

  if (!app) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA]">App not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Nav onUploadClick={() => setUploadOpen(true)} />

      <div className="pt-14 max-w-4xl mx-auto px-6 py-12">
        {/* Back */}
        <Link
          to="/gallery"
          className="text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black transition-colors"
        >
          ← Back to Gallery
        </Link>

        {/* Thumbnail */}
        <div className="mt-6 w-full aspect-video overflow-hidden bg-[#F0F0F0] border border-[#E5E5E5]">
          <img
            src={app.image}
            alt={app.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Header */}
        <div className="mt-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-[#E5E5E5] pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171] border border-[#E5E5E5] px-2 py-0.5">
                {app.category}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                Built with {app.tool}
              </span>
            </div>
            <h1
              className="text-3xl sm:text-5xl font-black uppercase text-black leading-none"
              style={{ letterSpacing: "-0.04em" }}
            >
              {app.name}
            </h1>
            <p className="mt-3 text-sm text-[#717171] max-w-lg leading-relaxed">
              {app.tagline}
            </p>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {/* Upvote */}
            <UpvoteButton appId={app.id} initialUpvotes={app.upvotes} />
            {/* Visit */}
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="h-12 px-8 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              Visit Live Site →
            </a>
          </div>
        </div>

        {/* Description */}
        <div className="mt-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA] mb-3">About</p>
          <p className="text-base text-black leading-relaxed max-w-2xl">{app.description}</p>
        </div>

        {/* Meta row */}
        <div className="mt-10 grid grid-cols-3 border border-[#E5E5E5]">
          {[
            { label: "Category", value: app.category },
            { label: "Built With", value: app.tool },
            { label: "Upvotes", value: <UpvoteCount appId={app.id} initialCount={app.upvotes} /> },
          ].map((item, i) => (
            <div
              key={item.label}
              className={`p-5 ${i < 2 ? "border-r border-[#E5E5E5]" : ""}`}
            >
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA] mb-1">{item.label}</p>
              <p className="text-sm font-black uppercase tracking-tight text-black">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="px-8 py-6 flex items-center justify-between border-t border-[#E5E5E5]">
        <span className="text-xs font-black uppercase tracking-widest text-black">VibedGallery</span>
        <span className="text-xs text-[#717171]">Apps built with AI, shared by their makers.</span>
      </footer>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}

function UpvoteCount({ appId, initialCount }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const fetchUpvotes = async () => {
      try {
        const { data, error } = await supabase
          .from('upvotes')
          .select('id')
          .eq('app_id', appId);
        
        if (!error && data) {
          setCount(data.length);
        }
      } catch (err) {
        console.error('Error fetching upvotes:', err);
      }
    };

    fetchUpvotes();
  }, [appId]);

  return <>{count}</>;
}

function UpvoteButton({ appId, initialUpvotes }) {
  const { user } = useAuth();
  const [upvoted, setUpvoted] = useState(false);
  const [count, setCount] = useState(initialUpvotes);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setUpvoted(false);
      return;
    }

    const checkUpvoted = async () => {
      try {
        const { data, error } = await supabase
          .from('upvotes')
          .select('id')
          .eq('app_id', appId)
          .eq('user_id', user.id)
          .single();
        
        setUpvoted(!error && !!data);
      } catch (err) {
        setUpvoted(false);
      }
    };

    checkUpvoted();
  }, [appId, user]);

  const handleUpvote = async () => {
    if (!user) {
      alert('Please log in to upvote.');
      return;
    }

    setLoading(true);
    try {
      if (upvoted) {
        await supabase
          .from('upvotes')
          .delete()
          .eq('app_id', appId)
          .eq('user_id', user.id);
        
        setCount(c => c - 1);
        setUpvoted(false);
      } else {
        await supabase
          .from('upvotes')
          .insert({ app_id: appId, user_id: user.id });
        
        setCount(c => c + 1);
        setUpvoted(true);
      }
    } catch (err) {
      console.error('Error updating upvote:', err);
      alert('Failed to update upvote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleUpvote}
      disabled={loading}
      className={`h-12 px-8 text-[10px] font-bold uppercase tracking-widest border transition-colors flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black disabled:opacity-50 disabled:cursor-not-allowed ${
        upvoted ? "bg-black text-white border-black" : "bg-white text-black border-[#E5E5E5] hover:border-black"
      }`}
    >
      ▲ {count} {upvoted ? "Upvoted" : "Upvote"}
    </button>
  );
}