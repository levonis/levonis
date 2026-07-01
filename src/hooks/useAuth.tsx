import React, { useState, useEffect, useMemo, useCallback, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isAssistant: boolean;
  isAdminOrAssistant: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAssistant, setIsAssistant] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Hard safety net: never let the app stay stuck on the loading screen
    // for more than 3s — even if Supabase auth never resolves (corrupted
    // sb-* localStorage, blocked network, slow cookie sync, etc.).
    const hardTimeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        // Unblock the app IMMEDIATELY once we know the session — do NOT wait
        // for the admin role check (slow networks would hang the whole UI).
        setLoading(false);
        clearTimeout(hardTimeout);
        if (session?.user) {
          // Fire-and-forget; isAdmin updates when it resolves.
          checkAdminStatus(session.user.id).catch(() => {});
        } else {
          setIsAdmin(false);
        }
      }
    );

    // THEN check for existing session — wrapped in try/catch because a
    // corrupted sb-* localStorage entry can throw synchronously and would
    // otherwise leave `loading` stuck at `true` forever (white screen after
    // login on some users' devices).
    try {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        clearTimeout(hardTimeout);
        if (session?.user) {
          checkAdminStatus(session.user.id).catch(() => {});
        } else {
          setIsAdmin(false);
        }
      }).catch((err) => {
        console.error('[useAuth] getSession failed:', err);
        // If the stored session is corrupt, wipe it so the next login is clean.
        try {
          Object.keys(localStorage)
            .filter((k) => k.startsWith('sb-') || k.includes('supabase'))
            .forEach((k) => localStorage.removeItem(k));
        } catch {}
        setLoading(false);
        clearTimeout(hardTimeout);
      });
    } catch (err) {
      console.error('[useAuth] getSession threw:', err);
      setLoading(false);
      clearTimeout(hardTimeout);
    }

    return () => {
      clearTimeout(hardTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .in('role', ['admin', 'assistant']);

      if (error) throw error;
      const roles = (data ?? []).map((r: any) => r.role);
      setIsAdmin(roles.includes('admin'));
      setIsAssistant(roles.includes('assistant'));
      return roles.includes('admin');
    } catch (error) {
      console.error('Admin role check failed:', error);
      setIsAdmin(false);
      setIsAssistant(false);
      return false;
    }
  };

  const signOut = async () => {
    try {
      setIsAdmin(false);
      setIsAssistant(false);
      // Clear all local storage auth data first for reliability on Android/Chrome
      const keysToRemove = Object.keys(localStorage).filter(k => 
        k.startsWith('sb-') || k.includes('supabase')
      );
      keysToRemove.forEach(k => localStorage.removeItem(k));
      
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('Sign out error:', error);
      // Force clear session state even if signOut API fails
      setUser(null);
      setSession(null);
    } finally {
      navigate('/');
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, isAssistant, isAdminOrAssistant: isAdmin || isAssistant, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};