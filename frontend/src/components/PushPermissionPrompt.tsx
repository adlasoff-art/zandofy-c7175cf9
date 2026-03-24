import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Button } from "@/components/ui/button";

export function PushPermissionPrompt() {
  const { supported, permission, isSubscribed, loading, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!supported || isSubscribed || permission === "denied" || permission === "granted") return;
    const key = "push_prompt_dismissed";
    const prev = localStorage.getItem(key);
    if (prev) {
      const ts = parseInt(prev, 10);
      // Don't re-show for 7 days after dismiss
      if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) return;
    }
    // Show after 3s delay
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, [supported, isSubscribed, permission]);

  if (!visible || dismissed || isSubscribed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("push_prompt_dismissed", String(Date.now()));
  };

  const handleAccept = async () => {
    const ok = await subscribe();
    if (ok) setDismissed(true);
    else handleDismiss();
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 bg-card border border-border rounded-xl shadow-xl p-4 animate-in slide-in-from-bottom-4 duration-300">
      <button onClick={handleDismiss} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
        <X size={16} />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Bell size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Activer les notifications</p>
          <p className="text-xs text-muted-foreground mt-1">
            Recevez des alertes en temps réel sur vos commandes, livraisons et promotions.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleAccept} disabled={loading} className="text-xs">
              {loading ? "Activation…" : "Activer"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-xs">
              Plus tard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
