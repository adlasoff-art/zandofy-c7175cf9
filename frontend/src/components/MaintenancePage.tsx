import { useState, useEffect } from "react";
import { Wrench, Clock, RefreshCw } from "lucide-react";

interface MaintenancePageProps {
  title: string;
  message: string;
  endTime: string; // ISO date string
}

export function MaintenancePage({ title, message, endTime }: MaintenancePageProps) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const end = new Date(endTime).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setExpired(true);
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Animated icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
            <Wrench size={36} className="text-primary" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {title || "Maintenance en cours"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {message || "Nous effectuons une mise à jour planifiée. La plateforme sera de retour très bientôt."}
          </p>
        </div>

        {/* Countdown */}
        {!expired ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Clock size={14} />
              <span>Retour estimé dans</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              {[
                { value: timeLeft.hours, label: "Heures" },
                { value: timeLeft.minutes, label: "Minutes" },
                { value: timeLeft.seconds, label: "Secondes" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-card border border-border rounded-xl flex items-center justify-center shadow-sm">
                    <span className="text-2xl font-bold text-foreground tabular-nums">
                      {pad(item.value)}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1.5">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-primary font-medium">
              La maintenance devrait être terminée. Rechargez la page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              <RefreshCw size={14} />
              Recharger
            </button>
          </div>
        )}

        {/* Brand */}
        <div className="pt-4 border-t border-border">
          <span className="text-xs text-muted-foreground">
            Zandofy — Merci pour votre patience 💛
          </span>
        </div>
      </div>

    </div>
  );
}
