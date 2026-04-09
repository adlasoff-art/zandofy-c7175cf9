import { Shield } from "lucide-react";

interface SeoVerificationSectionProps {
  googleSiteVerification: string;
  googleAnalyticsId: string;
  onVerificationChange: (val: string) => void;
  onAnalyticsChange: (val: string) => void;
  inputClass: string;
}

export function SeoVerificationSection({
  googleSiteVerification,
  googleAnalyticsId,
  onVerificationChange,
  onAnalyticsChange,
  inputClass,
}: SeoVerificationSectionProps) {
  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Vérification & Analytics</h2>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Google Site Verification (code)</label>
          <input
            value={googleSiteVerification}
            onChange={(e) => onVerificationChange(e.target.value)}
            placeholder="ex: abc123def456..."
            className={inputClass}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Le contenu de la balise meta &quot;google-site-verification&quot; fourni par Google Search Console.
          </p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Google Analytics / GTM ID</label>
          <input
            value={googleAnalyticsId}
            onChange={(e) => onAnalyticsChange(e.target.value)}
            placeholder="G-XXXXXXXX ou GTM-XXXXXXX"
            className={inputClass}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            ID Google Analytics 4 (G-...) ou Google Tag Manager (GTM-...).
          </p>
        </div>
      </div>
    </section>
  );
}
