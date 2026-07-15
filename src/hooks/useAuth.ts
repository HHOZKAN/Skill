import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type AuthStatus =
  | 'disabled'   // Supabase non configuré → mode 100 % local
  | 'loading'    // session en cours de récupération
  | 'signed-out'
  | 'signed-in';

export interface AuthState {
  status: AuthStatus;
  session: Session | null;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

/* Gère la session Supabase (connexion par lien magique). Quand Supabase
   n'est pas configuré, renvoie le statut "disabled" pour que l'app reste
   utilisable en local sans authentification. */
export function useAuth(): AuthState {
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'disabled');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? 'signed-in' : 'signed-out');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? 'signed-in' : 'signed-out');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string) => {
    if (!supabase) return { error: 'Authentification indisponible.' };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error ? error.message : null };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return { status, session, signInWithEmail, signOut };
}
