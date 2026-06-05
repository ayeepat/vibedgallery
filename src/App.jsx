import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from '@/lib/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import PageTransition from './components/PageTransition';

// Pages are lazy-loaded so each route ships its own chunk instead of one
// monolithic bundle. The common entry paths (Home/Gallery) no longer pay the
// download cost of Admin, Submit, the auth flow, framer-heavy pages, etc.
const PageNotFound   = lazy(() => import('./lib/PageNotFound'));
const Login          = lazy(() => import('./pages/Login'));
const Register       = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword  = lazy(() => import('./pages/ResetPassword'));
const AuthCallback   = lazy(() => import('./pages/AuthCallback'));
const Home           = lazy(() => import('./pages/Home'));
const Gallery        = lazy(() => import('./pages/Gallery'));
const AppDetail      = lazy(() => import('./pages/AppDetail'));
const HowItWorks     = lazy(() => import('./pages/HowItWorks'));
const Submit         = lazy(() => import('./pages/Submit'));
const Admin          = lazy(() => import('./pages/Admin'));
const Profile        = lazy(() => import('./pages/Profile'));
const Maker          = lazy(() => import('./pages/Maker'));
const About          = lazy(() => import('./pages/About'));

const wrap = (el) => <PageTransition>{el}</PageTransition>;

const RouteFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-white">
    <Loader2 className="w-6 h-6 animate-spin text-[#717171]" />
  </div>
);

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location} key={location.pathname}>
          {/* Public */}
          <Route path="/"                element={wrap(<Home />)} />
          <Route path="/gallery"         element={wrap(<Gallery />)} />
          <Route path="/app/:id"         element={wrap(<AppDetail />)} />
          <Route path="/maker/:userId"   element={wrap(<Maker />)} />
          <Route path="/how-it-works"    element={wrap(<HowItWorks />)} />
          <Route path="/about"           element={wrap(<About />)} />

          {/* Auth */}
          <Route path="/login"           element={wrap(<Login />)} />
          <Route path="/register"        element={wrap(<Register />)} />
          <Route path="/forgot-password" element={wrap(<ForgotPassword />)} />
          <Route path="/reset-password"  element={wrap(<ResetPassword />)} />
          <Route path="/auth/callback"   element={<AuthCallback />} />

          {/* Submission + Admin */}
          <Route path="/submit"          element={wrap(<ProtectedRoute><Submit /></ProtectedRoute>)} />
          <Route path="/admin"           element={wrap(<ProtectedRoute adminOnly><Admin /></ProtectedRoute>)} />
          <Route path="/profile"         element={wrap(<ProtectedRoute><Profile /></ProtectedRoute>)} />

          {/* 404 */}
          <Route path="*"                element={wrap(<PageNotFound />)} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <QueryClientProvider client={queryClientInstance}>
            <ScrollToTop />
            <AnimatedRoutes />
            <Toaster />
            <Analytics />
            <SpeedInsights />
          </QueryClientProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  )
}

export default App
