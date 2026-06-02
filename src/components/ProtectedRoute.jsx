import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
  </div>
);

/**
 * Route guard for authenticated pages.
 *
 * Usage (React Router v6 layout route):
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/profile" element={<Profile />} />
 *   </Route>
 *
 * Pass `adminOnly` to additionally require an admin role.
 *
 * This is a client-side UX guard only. Authorization is enforced
 * server-side via Supabase Row Level Security.
 */
export default function ProtectedRoute({
  fallback = <DefaultFallback />,
  redirectTo = '/login',
  adminOnly = false,
}) {
  const {
    isAuthenticated,
    isLoadingAuth,
    authChecked,
    authError,
    isAdmin,
    checkUserAuth,
  } = useAuth();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
