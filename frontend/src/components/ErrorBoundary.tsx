import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Could send to error tracking service in the future
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReload = () => {
    // Clear SW caches and hard reload
    if ("caches" in window) {
      caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="text-center max-w-md space-y-4">
            <div className="text-5xl">😵</div>
            <h1 className="text-xl font-bold text-foreground">
              Oups, quelque chose s'est mal passé
            </h1>
            <p className="text-sm text-muted-foreground">
              Une erreur inattendue est survenue. Essayez de recharger la page.
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              Recharger la page
            </button>
            {this.state.error && (
              <details className="text-xs text-muted-foreground mt-4 text-left">
                <summary className="cursor-pointer">Détails techniques</summary>
                <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
