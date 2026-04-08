import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../config/supabase';
import { normalizeUser } from '../utils/auth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(null); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);
  
  const getManualSession = () => {
    const isPasswordLogin = localStorage.getItem('idaic-password-login') === 'true';
    const savedEmail = localStorage.getItem('idaic-password-email');
    return isPasswordLogin && savedEmail ? { email: savedEmail } : null;
  };

  const syncState = (enhancedUser) => {
    console.log('🔄 AuthContext: syncState ->', enhancedUser?.email || 'null');
    if (enhancedUser) {
      setUser(enhancedUser);
      setIsAuthenticated(true);
      setIsAdmin(enhancedUser.role === 'admin' || enhancedUser.role === 'moderator' || enhancedUser.role === 'super_admin');
    } else {
      setUser(null);
      setIsAuthenticated(false);
      setIsAdmin(false);
    }
    setLoading(false);
    initialized.current = true;
  };

  // BACKGROUND enrichment
  const refreshUserProfile = async (currentUser) => {
    if (!currentUser?.email) return;
    try {
      const { data: userData } = await supabase.from('users').select('*').eq('email', currentUser.email).maybeSingle();
      if (userData) {
        const enriched = { ...currentUser, ...userData, role: userData.role || 'user' };
        setUser(enriched);
        setIsAdmin(enriched.role === 'admin' || enriched.role === 'moderator' || enriched.role === 'super_admin');
        
        if (userData.role === 'new' || userData.role === 'declined') {
          logout();
        }
      }
    } catch (e) {
      console.warn('⚠️ AuthContext: Background refresh failed');
    }
  };

  const handleSessionChange = (supabaseUser, manualData = null) => {
    const email = supabaseUser?.email || manualData?.email;
    if (!email) {
      syncState(null);
      return;
    }

    // 1. Enter the app INSTANTLY with basic user info
    const source = supabaseUser ? 'supabase' : 'password';
    const basicUser = normalizeUser({ ...supabaseUser, email }, source);
    
    // If it's a nexusclimate email, assume admin until DB says otherwise
    if (email.endsWith('@nexusclimate.ae') || email.endsWith('@nexusclimate.co')) {
      basicUser.role = 'admin';
    }

    syncState(basicUser);

    // 2. Fetch full role in the background
    refreshUserProfile(basicUser);
  };

  useEffect(() => {
    // Check initial Supabase state
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleSessionChange(session.user);
      } else {
        const manual = getManualSession();
        if (manual) handleSessionChange(null, manual);
        else syncState(null);
      }
    });

    // Setup listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔄 AuthContext Event: ${event}`);
      if (session?.user) {
        handleSessionChange(session.user);
      } else if (event === 'SIGNED_OUT' && !getManualSession()) {
        syncState(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const logout = async () => {
    localStorage.clear();
    await supabase.auth.signOut();
    window.location.href = '/login.html';
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isAdmin, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
