import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Loader2 } from 'lucide-react';

const Fallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <Loader2 className="w-6 h-6 animate-spin text-[#717171]" />
  </div>
);

// Wrap a route to require sign-in. Pass `adminOnly` to also require profile.role === 'admin'.
// Unauthenticated users are sent to /login with a `from` query param so Login can return them.
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isLoadingAuth, profile, isAdmin } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) return <Fallback />;

  if (!isAuthenticated) {
    const from = location.pathname + location.search;
    return <Navigate to={`/login?from=${encodeURIComponent(from)}`} replace />;
  }

  if (adminOnly) {
    if (!profile) return <Fallback />;
    if (!isAdmin) return <Navigate to="/" replace />;
  }

  return children;
}
