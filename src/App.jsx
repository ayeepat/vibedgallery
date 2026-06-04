import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import PageTransition from './components/PageTransition';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AuthCallback from './pages/AuthCallback';
import Home from './pages/Home';
import Gallery from './pages/Gallery';
import AppDetail from './pages/AppDetail';
import HowItWorks from './pages/HowItWorks';
import Submit from './pages/Submit';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import Maker from './pages/Maker';

const wrap = (el) => <PageTransition>{el}</PageTransition>;

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        {/* Public */}
        <Route path="/"                element={wrap(<Home />)} />
        <Route path="/gallery"         element={wrap(<Gallery />)} />
        <Route path="/app/:id"         element={wrap(<AppDetail />)} />
        <Route path="/maker/:userId"   element={wrap(<Maker />)} />
        <Route path="/how-it-works"    element={wrap(<HowItWorks />)} />

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
