import React, { Component, type ReactNode } from "react";
import { reportError } from "@/services/error-reporter";
import { AlertTriangle, MessageCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional callback to open the support drawer */
  onOpenSupport?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  reported: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, reported: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);

    // Report to admin in background
    if (!this.state.reported) {
      reportError({
        error,
        componentStack: errorInfo.componentStack ?? undefined,
      });
      this.setState({ reported: true });
    }
  }

  handleReload = () => {
    if ("caches" in window) {
      caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
    }
    window.location.reload();
  };

  handleSupport = () => {
    if (this.props.onOpenSupport) {
      this.props.onOpenSupport();
    } else {
      // Fallback: navigate to support page
      window.location.href = "/support";
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="text-center max-w-md space-y-6">
            {/* Icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-foreground">
                Oups ! Un problème est survenu
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Nos équipes ont été automatiquement alertées et travaillent à
                résoudre ce problème. Vous pouvez recharger la page ou contacter
                le support pour obtenir de l'aide.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="w-4 h-4" />
                Recharger la page
              </button>
              <button
                onClick={this.handleSupport}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-border bg-card text-foreground font-medium hover:bg-accent transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Contacter le support
              </button>
            </div>

            {/* Subtle reference ID for support follow-up */}
            <p className="text-[10px] text-muted-foreground/60">
              Référence : {new Date().toISOString().slice(0, 19).replace("T", "-")}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
