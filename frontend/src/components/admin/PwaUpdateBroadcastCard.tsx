import { useState } from "react";
import { Loader2, Megaphone, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { APP_VERSION, SHOW_UPDATE_PROMPT } from "@/version";

/**
 * Admin-only card to broadcast a "new app version available" Web Push to all
 * active PWA subscribers. Calls the `notify-app-update` edge function.
 *
 * Use only after a minor/major version bump (`SHOW_UPDATE_PROMPT = true`).
 */
export function PwaUpdateBroadcastCard() {
  const { toast } = useToast();
  const [version, setVersion] = useState(APP_VERSION);
  const [title, setTitle] = useState(`Nouvelle version Zandofy v${APP_VERSION}`);
  const [body, setBody] = useState("Touchez pour mettre à jour l'application.");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ recipients?: number; sent?: number } | null>(null);

  const handleSend = async () => {
    if (!version.trim()) return;
    if (!confirm(`Envoyer une notification "Mise à jour v${version}" à TOUS les utilisateurs PWA installés ?`)) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("notify-app-update", {
        body: { version: version.trim(), title, body },
      });
      if (error) throw error;
      setLastResult({ recipients: (data as any)?.recipients, sent: (data as any)?.sent });
      toast({
        title: "Push envoyée",
        description: `Destinataires : ${(data as any)?.recipients ?? 0} — délivrées : ${(data as any)?.sent ?? 0}`,
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message || "Échec de l'envoi de la notification de mise à jour.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Megaphone size={16} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Notification de mise à jour PWA</h2>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Diffuse une notification push à tous les utilisateurs ayant installé l'application,
        pour les inviter à mettre à jour vers la nouvelle version.
        À utiliser uniquement après un bump <strong>minor</strong> ou <strong>major</strong>.
      </p>

      <div className="text-xs space-y-1 bg-muted/50 rounded-lg p-3">
        <div>Version actuelle du build : <strong>{APP_VERSION}</strong></div>
        <div>
          Modale "mise à jour" :{" "}
          <strong className={SHOW_UPDATE_PROMPT ? "text-primary" : "text-muted-foreground"}>
            {SHOW_UPDATE_PROMPT ? "ACTIVE" : "désactivée (patch silencieux)"}
          </strong>
        </div>
      </div>

      <div className="grid gap-3">
        <label className="block">
          <span className="text-xs text-muted-foreground">Version à annoncer</span>
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
            placeholder="1.9.0"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Titre</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
        </label>
      </div>

      <button
        onClick={handleSend}
        disabled={loading || !version.trim()}
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm rounded-lg disabled:opacity-60"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {loading ? "Envoi en cours…" : "Diffuser la notification"}
      </button>

      {lastResult && (
        <div className="text-xs text-muted-foreground">
          Dernier envoi → destinataires : {lastResult.recipients ?? 0}, délivrées : {lastResult.sent ?? 0}.
        </div>
      )}
    </div>
  );
}