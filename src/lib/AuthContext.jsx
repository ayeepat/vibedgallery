import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { sanitizeRedirectPath } from '@/lib/urlHelpers';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]               = useState(null);
  const [profile, setProfile]         = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth]     = useState(true);
  const [authError, setAuthError]             = useState(null);
  const [authChecked, setAuthChecked]         = useState(false);

  // Tracks which user id we've already loaded a profile for. onAuthStateChange
  // fires on every TOKEN_REFRESHED (~hourly) and INITIAL_SESSION in addition to
  // sign-in/out; without this guard we'd refetch the profile on each one and,
  // worse, a transient fetch error during a token refresh would wipe a good
  // profile (flipping isAdmin off). We only fetch when the user id changes.
  const loadedProfileForId = useRef(null);

  // Fetch profile from profiles table
  const fetchProfile = async (userId) => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
      return data;
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile(null);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const applySession = (session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setIsAuthenticated(!!currentUser);
      setAuthChecked(true);
      setIsLoadingAuth(false);

      if (currentUser) {
        if (loadedProfileForId.current !== currentUser.id) {
          loadedProfileForId.current = currentUser.id;
          fetchProfile(currentUser.id);
        }
      } else {
        loadedProfileForId.current = null;
        setProfile(null);
      }
    };

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.error('Session restore error:', error);
      applySession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => applySession(session)
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  const register = async (email, password, name = '') => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/login`,
      }
    });
    if (error) throw error;
    return data;
  };

  const verifyOtp = async (email, otp) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'signup',
    });
    if (error) throw error;
    return data;
  };

  const resendOtp = async (email) => {
    setAuthError(null);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    if (error) throw error;
  };

  const login = async (email, password) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  // Kick off an OAuth sign-in. Supabase redirects the browser to the provider,
  // then the provider redirects back to `redirectTo`. AuthCallback finishes
  // the handoff and routes the user to the original destination.
  //
  // We stash the post-login "next" path in sessionStorage instead of appending
  // it to the redirect URL — adding a query string to `redirectTo` can trip
  // Supabase's redirect-URL allow-list matching and force a fall-back to the
  // Site URL.
  const signInWithProvider = async (provider, { redirectPath = '/' } = {}) => {
    setAuthError(null);
    const safePath = sanitizeRedirectPath(redirectPath);
    try {
      sessionStorage.setItem('postAuthRedirect', safePath);
    } catch {
      // sessionStorage can throw in private windows; the callback page will
      // just default to '/' in that case.
    }
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) throw error;
    return data;
  };

  const logout = async (shouldRedirect = true) => {
    setAuthError(null);
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Logout error:', error);
    setUser(null);
    setProfile(null);
    setIsAuthenticated(false);
    if (shouldRedirect) window.location.href = '/login';
  };

  const forgotPassword = async (email) => {
    setAuthError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const resetPassword = async (newPassword) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
    return data;
  };

  const getProfile = async () => {
    if (!user) return null;
    return fetchProfile(user.id);
  };

  const updateProfile = async (updates) => {
    if (!user) throw new Error('Not logged in');
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw error;
    setProfile(data);
    return data;
  };

  const checkUserAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    setIsAuthenticated(!!session?.user);
    setAuthChecked(true);
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      isAuthenticated,
      isLoadingAuth,
      authError,
      authChecked,

      login,
      logout,
      register,
      signInWithProvider,
      verifyOtp,
      resendOtp,
      forgotPassword,
      resetPassword,
      getProfile,
      updateProfile,

      checkUserAuth,
      navigateToLogin,

      isAdmin: profile?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};