"use client";
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthState {
  user: User | null;
  loading: boolean;
  /** マジックリンク送信（メールアドレスにログインリンクを送る） */
  sendMagicLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  sendMagicLink: async () => ({ error: null }),
  signOut: async () => {},
});

function getAuthRedirectUrl() {
  const userAgent = navigator.userAgent || "";
  if (userAgent.includes("PokeDamageCalcApp")) {
    return "pokedamagecalc://auth/callback";
  }
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) {
    return `${configuredUrl.replace(/\/+$/, "")}/auth/callback`;
  }
  return `${window.location.origin}/auth/callback`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, sendMagicLink, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
