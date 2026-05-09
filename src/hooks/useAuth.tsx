import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        // Unblock the app IMMEDIATELY once we know the session — do NOT wait
        // for the admin role check (slow networks would hang the whole UI).
        setLoading(false);
        if (session?.user) {
          // Fire-and-forget; isAdmin updates when it resolves.
          checkAdminStatus(session.user.id).catch(() => {});
        } else {
          setIsAdmin(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        checkAdminStatus(session.user.id).catch(() => {});
      } else {
        setIsAdmin(false);
      }
    }).catch(() => {
      // Even if getSession fails (e.g., network), don't keep the app stuck.
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) throw error;
      setIsAdmin(!!data);
      return !!data;
    } catch (error) {
      console.error('Admin role check failed:', error);
      setIsAdmin(false);
      return false;
    }
  };

  const signOut = async () => {
    try {
      setIsAdmin(false);
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
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signOut }}>
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