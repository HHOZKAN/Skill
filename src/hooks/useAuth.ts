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
  authError: string | null;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

/* Un lien expiré ou déjà utilisé ne ramène pas de jeton mais une erreur dans
   le fragment (#error=…&error_code=otp_expired&…). Sans ce décodage, l'app
   retombait silencieusement sur l'écran de connexion, sans dire pourquoi.
   Lecture pure (aucune mutation) : le nettoyage de l'URL se fait dans un effet,
   sinon React la nettoierait dès la double-exécution du mode strict. */
function readAuthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const sources = [
    window.location.hash.replace(/^#\/?/, ''),
    window.location.search.replace(/^\?/, ''),
  ];
  for (const raw of sources) {
    const params = new URLSearchParams(raw);
    if (!params.get('error') && !params.get('error_description') && !params.get('error_code')) continue;
    const code = params.get('error_code') ?? '';
    const desc = params.get('error_description') ?? params.get('error') ?? '';
    if (/expired/i.test(code) || /expired/i.test(desc)) {
      return 'Ce lien de connexion a expiré. Demande-en un nouveau ci-dessous.';
    }
    const readable = decodeURIComponent(desc).replace(/\+/g, ' ').trim();
    return readable || 'La connexion a échoué. Demande un nouveau lien.';
  }
  return null;
}

/* Gère la session Supabase (connexion par lien magique). Quand Supabase
   n'est pas configuré, renvoie le statut "disabled" pour que l'app reste
   utilisable en local sans authentification. */
export function useAuth(): AuthState {
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'disabled');
  const [session, setSession] = useState<Session | null>(null);
  const [authError] = useState<string | null>(readAuthErrorFromUrl);

  // L'erreur captée, on efface le fragment pour qu'elle ne survive pas à un rechargement.
  useEffect(() => {
    if (authError) window.history.replaceState(null, '', window.location.pathname + '#/');
  }, [authError]);

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

  return { status, session, authError, signInWithEmail, signOut };
}
