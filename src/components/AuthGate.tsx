import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { configError } from '../lib/supabase';
import { loadFromSupabase } from '../store/useStore';

/* Contrôle l'accès quand la base cloud est configurée :
   - "disabled" (pas de Supabase) → app en local, sans connexion ;
   - "signed-in" → charge les données de l'utilisateur puis affiche l'app ;
   - sinon → écran de connexion par lien magique. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { status, session, signInWithEmail, signOut } = useAuth();
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (status === 'signed-in' && session?.user?.id) {
      if (loadedFor.current !== session.user.id) {
        loadedFor.current = session.user.id;
        void loadFromSupabase();
      }
    } else if (status === 'signed-out') {
      loadedFor.current = null;
    }
  }, [status, session]);

  if (configError) return <ConfigErrorScreen problem={configError} />;

  if (status === 'disabled' || status === 'signed-in') {
    return (
      <>
        {children}
        {status === 'signed-in' && (
          <AccountChip email={session?.user?.email ?? ''} onSignOut={signOut} />
        )}
      </>
    );
  }

  if (status === 'loading') {
    return (
      <div className="auth-screen">
        <div className="auth-spinner" aria-label="Chargement" />
      </div>
    );
  }

  return <LoginScreen onSubmit={signInWithEmail} />;
}

/* Sans ce écran, une variable d'environnement erronée se manifeste seulement
   par un message brut de Supabase au moment d'envoyer le lien de connexion. */
function ConfigErrorScreen({ problem }: { problem: string }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">⚠</div>
        <h1>Configuration incomplète</h1>
        <p className="auth-sub">La connexion au cloud ne peut pas démarrer</p>

        <div className="auth-error">{problem}</div>

        <div className="auth-fix">
          <p>Dans Supabase : <strong>Project Settings → Data API</strong>, copie le champ <strong>Project URL</strong>. Il a cette forme :</p>
          <code>https://&lt;projet&gt;.supabase.co</code>
          <p className="auth-hint">
            Reporte-le dans les variables d'environnement de l'hébergeur, puis <strong>redéploie</strong> :
            les variables <code>VITE_*</code> sont figées au moment du build.
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onSubmit }: { onSubmit: (email: string) => Promise<{ error: string | null }> }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setState('sending');
    setError(null);
    const { error } = await onSubmit(email.trim());
    if (error) { setError(error); setState('idle'); }
    else setState('sent');
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">✦</div>
        <h1>Constellations</h1>
        <p className="auth-sub">Atlas des savoirs</p>

        {state === 'sent' ? (
          <div className="auth-sent">
            <div className="auth-sent-emoji">📬</div>
            <p>Un lien de connexion a été envoyé à<br /><strong>{email}</strong>.</p>
            <p className="auth-hint">Ouvre-le sur cet appareil pour accéder à ton atlas.</p>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <label htmlFor="auth-email">Connexion par e-mail</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              placeholder="toi@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'Envoi…' : 'Recevoir le lien de connexion'}
            </button>
            {error && <div className="auth-error">{error}</div>}
            <p className="auth-hint">Pas de mot de passe : tu reçois un lien à usage unique.</p>
          </form>
        )}
      </div>
    </div>
  );
}

function AccountChip({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="account-chip">
      <button type="button" className="account-chip-btn" onClick={() => setOpen((v) => !v)} title={email}>
        <span className="account-dot" />
        {email}
      </button>
      {open && (
        <div className="account-menu">
          <button type="button" onClick={onSignOut}>Se déconnecter</button>
        </div>
      )}
    </div>
  );
}
