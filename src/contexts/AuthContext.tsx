import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
  });

  // Fetch profile from the profiles table
  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      setState((prev) => ({ ...prev, profile: data as Profile }));
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    let cancelled = false;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      const user = session?.user ?? null;
      setState((prev) => ({ ...prev, user, loading: false }));

      if (user) {
        fetchProfile(user.id).catch(() => {
          // Profile fetch is best-effort — user still has a valid session
        });
      }
    }).catch(() => {
      if (!cancelled) {
        setState((prev) => ({ ...prev, loading: false }));
      }
    });

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setState((prev) => ({ ...prev, user }));

      if (user) {
        fetchProfile(user.id).catch(() => {
          // Best-effort profile fetch
        });
      } else {
        setState((prev) => ({ ...prev, profile: null }));
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signUp = async (
    name: string,
    email: string,
    password: string
  ): Promise<string | null> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) return error.message;
    return null;
  };

  const signIn = async (
    email: string,
    password: string
  ): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return error.message;
    return null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setState({ user: null, profile: null, loading: false });
  };

  return (
    <AuthContext.Provider
      value={{ ...state, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}