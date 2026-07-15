import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/* Filet de sécurité : capture toute erreur de rendu pour éviter l'écran
   blanc en production et offrir un rechargement. Les données sont conservées
   (localStorage + cloud), donc un rechargement suffit en général. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur non gérée :', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash-screen">
        <div className="crash-card">
          <div className="crash-emoji">🌌</div>
          <h1>Une erreur est survenue</h1>
          <p>Tes notes sont sauvegardées. Recharge la page pour continuer.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Recharger
          </button>
        </div>
      </div>
    );
  }
}
