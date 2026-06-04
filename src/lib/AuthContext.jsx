import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]               = useState(null);
  const [profile, setProfile]         = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth]     = useState(true);
  const [authError, setAuthError]             = useState(null);
  const [authChecked, setAuthChecked]         = useState(false);

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
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.error('Session restore error:', error);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setIsAuthenticated(!!currentUser);
      setAuthChecked(true);
      setIsLoadingAuth(false);
      if (currentUser) fetchProfile(currentUser.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setIsAuthenticated(!!currentUser);
        setAuthChecked(true);
        setIsLoadingAuth(false);
        if (currentUser) fetchProfile(currentUser.id);
        else setProfile(null);
      }
    );

    return () => subscription?.unsubscribe?.();
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