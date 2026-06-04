import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';

const Fallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <Loader2 className="w-6 h-6 animate-spin text-[#717171]" />
  </div>
);

// Wrap a route to require sign-in. Pass `adminOnly` to also require profile.role === 'admin'.
// Unauthenticated users are sent to /login with a `from` query param so Login can return them.
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isLoadingAuth, user, profile } = useAuth();
  const location = useLocation();

  // Admin role lookup. We fall through to `profile.role` from AuthContext when it's loaded,
  // but on initial mount profile may still be null while the fetch is in-flight.
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!adminOnly) return;
    if (!user) {
      setAdminChecked(true);
      setIsAdmin(false);
      return;
    }
    if (profile) {
      setIsAdmin(profile.role === 'admin');
      setAdminChecked(true);
      return;
    }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setIsAdmin(data?.role === 'admin');
        setAdminChecked(true);
      });
    return () => { cancelled = true; };
  }, [adminOnly, user, profile]);

  if (isLoadingAuth) return <Fallback />;

  if (!isAuthenticated) {
    const from = location.pathname + location.search;
    return <Navigate to={`/login?from=${encodeURIComponent(from)}`} replace />;
  }

  if (adminOnly) {
    if (!adminChecked) return <Fallback />;
    if (!isAdmin) return <Navigate to="/" replace />;
  }

  return children;
}
