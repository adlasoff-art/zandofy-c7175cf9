import React, { Component, type ReactNode } from "react";
import { reportError } from "@/services/error-reporter";
import { AlertTriangle, MessageCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional callback to open the support drawer */
  onOpenSupport?: () => void;
  /** When this value changes (e.g. route path), recover from a previous crash. */
  resetKey?: string;
  /** Compact inline fallback (e.g. wrap a single widget without full-page Oops). */
  inline?: boolean;
  /** Custom inline message */
  inlineMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  reported: boolean;
  autoRecovering: boolean;
}

function isChunkOrStaleDeployError(error?: Error): boolean {
  const msg = error?.message || String(error || "");
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Loading chunk") ||
    msg.includes("Loading CSS chunk") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("ChunkLoadError")
  );
}

async function nukeCachesAndReload() {
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
    }
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem("chunk_reload_attempted");
  } catch {
    /* ignore */
  }
  window.location.reload();
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, reported: false, autoRecovering: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.state.hasError &&
      prevProps.resetKey !== undefined &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false, error: undefined, reported: false, autoRecovering: false });
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);

    // Auto-recover once for stale PWA / chunk mismatches (most common "Oups" after deploy)
    if (isChunkOrStaleDeployError(error)) {
      const key = "eb_chunk_autorecover";
      const tried = sessionStorage.getItem(key) === "1";
      if (!tried) {
        sessionStorage.setItem(key, "1");
        this.setState({ autoRecovering: true });
        void nukeCachesAndReload();
        return;
      }
    }

    if (!this.state.reported) {
      reportError({
        error,
        componentStack: errorInfo.componentStack ?? undefined,
      });
      this.setState({ reported: true });
    }
  }

  handleReload = () => {
    void nukeCachesAndReload();
  };

  handleSupport = () => {
    if (this.props.onOpenSupport) {
      this.props.onOpenSupport();
    } else {
      window.location.href = "/help-center";
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.state.autoRecovering) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <p className="text-sm text-muted-foreground">Mise à jour en cours…</p>
          </div>
        );
      }

      const detail = this.state.error?.message || "";

      if (this.props.inline) {
        return (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-left space-y-2">
            <p className="text-xs text-destructive font-medium">
              {this.props.inlineMessage || "Impossible d’afficher ce bloc. Rechargez la page."}
            </p>
            {detail ? (
              <p className="text-[10px] font-mono text-muted-foreground break-words">{detail}</p>
            ) : null}
            <button
              type="button"
              onClick={this.handleReload}
              className="text-xs font-semibold text-primary underline"
            >
              Recharger
            </button>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="text-center max-w-md space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-foreground">
                Oups ! Un problème est survenu
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Nos équipes ont été automatiquement alertées. Rechargez la page
                pour récupérer la dernière version de l&apos;application.
              </p>
              {detail ? (
                <p className="text-[11px] text-left font-mono bg-muted/60 border border-border rounded-md p-2 break-words text-muted-foreground">
                  {detail}
                </p>
              ) : null}
            </div>

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
