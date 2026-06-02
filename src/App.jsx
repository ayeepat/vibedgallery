import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import Gallery from './pages/Gallery';
import AppDetail from './pages/AppDetail';
import HowItWorks from './pages/HowItWorks';
import Submit from './pages/Submit';
import Admin from './pages/Admin';
import Profile from './pages/Profile';

function App() {
  return (
    <Router>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <ScrollToTop />
          <Routes>
            {/* Public */}
            <Route path="/"                element={<Home />} />
            <Route path="/gallery"         element={<Gallery />} />
            <Route path="/app/:id"         element={<AppDetail />} />
            <Route path="/how-it-works"    element={<HowItWorks />} />

            {/* Auth */}
            <Route path="/login"           element={<Login />} />
            <Route path="/register"        element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />

            {/* Submission + Admin */}
            <Route path="/submit"          element={<Submit />} />
            <Route path="/admin"           element={<Admin />} />
            <Route path="/profile"         element={<Profile />} />

            {/* 404 */}
            <Route path="*"               element={<PageNotFound />} />
          </Routes>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </Router>
  )
}

export default App