import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";
import { useBootstrapSetting } from "@/hooks/use-platform-bootstrap";

interface CookieConfig {
  enabled: boolean;
  message: string;
  accept_label: string;
  decline_label: string;
  analytics_enabled: boolean;
  marketing_enabled: boolean;
}

const DEFAULT_CONFIG: CookieConfig = {
  enabled: false,
  message: "Nous utilisons des cookies pour améliorer votre expérience. En continuant, vous acceptez notre utilisation des cookies.",
  accept_label: "Accepter",
  decline_label: "Refuser",
  analytics_enabled: true,
  marketing_enabled: false,
};

export function CookieConsent() {
  const [config, setConfig] = useState<CookieConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const { value: cfg } = useBootstrapSetting<any>("cookie_settings");

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (consent) return; // Already answered
    if (cfg?.enabled) {
      setConfig({ ...DEFAULT_CONFIG, ...cfg });
      setVisible(true);
    }
  }, [cfg]);

  const handleAccept = () => {
    localStorage.setItem("cookie_consent", JSON.stringify({
      accepted: true,
      analytics: config?.analytics_enabled ?? true,
      marketing: config?.marketing_enabled ?? false,
      timestamp: new Date().toISOString(),
    }));
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookie_consent", JSON.stringify({
      accepted: false,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
    }));
    setVisible(false);
  };

  if (!visible || !config) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] p-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="max-w-lg mx-auto bg-card border border-border rounded-xl shadow-xl p-4">
        <div className="flex items-start gap-3">
          <Cookie size={20} className="text-primary shrink-0 mt-0.5" />
          <div className="flex-1 space-y-3">
            <p className="text-sm text-foreground leading-relaxed">{config.message}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAccept} className="text-xs">
                {config.accept_label}
              </Button>
              <Button size="sm" variant="outline" onClick={handleDecline} className="text-xs">
                {config.decline_label}
              </Button>
            </div>
          </div>
          <button onClick={handleDecline} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
