import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, Share2 } from "lucide-react";

/**
 * Public page: download Android APK (TWA) when published, plus PWA install fallback.
 * APK URL via VITE_ANDROID_APK_URL (cms-assets public URL after Bubblewrap build).
 */
export default function GetAppPage() {
  const apkUrl = (import.meta.env.VITE_ANDROID_APK_URL as string | undefined)?.trim() || "";

  const shareApk = async () => {
    if (!apkUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Zandofy Android",
          text: "Installez Zandofy sur Android",
          url: apkUrl,
        });
      } else {
        await navigator.clipboard.writeText(apkUrl);
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title="Télécharger Zandofy | App Android"
        description="Installez Zandofy sur Android : APK ou application web (PWA)."
      />
      <Header />
      <main className="flex-1 container max-w-lg py-10 space-y-8">
        <div className="text-center space-y-2">
          <Smartphone className="mx-auto text-primary" size={40} />
          <h1 className="text-2xl font-bold text-foreground">Zandofy sur Android</h1>
          <p className="text-sm text-muted-foreground">
            Téléchargez l’APK pour l’envoyer à un proche, ou installez la PWA depuis Chrome.
          </p>
        </div>

        {apkUrl ? (
          <div className="space-y-3 border border-border rounded-xl p-5 bg-card">
            <h2 className="text-sm font-semibold">APK (Trusted Web Activity)</h2>
            <p className="text-xs text-muted-foreground">
              Fichier installable hors Play Store. Autorisez l’installation depuis des sources
              inconnues si demandé.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild className="flex-1">
                <a href={apkUrl} download>
                  <Download size={16} className="mr-2" /> Télécharger l’APK
                </a>
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={shareApk}>
                <Share2 size={16} className="mr-2" /> Partager le lien
              </Button>
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-border rounded-xl p-5 text-sm text-muted-foreground">
            L’APK sera publié ici après le build TWA (Bubblewrap/PWABuilder). En attendant,
            utilisez l’installation PWA ci-dessous. Voir docs/guides/TWA_APK.md.
          </div>
        )}

        <div className="space-y-3 border border-border rounded-xl p-5 bg-card">
          <h2 className="text-sm font-semibold">Application web (PWA)</h2>
          <p className="text-xs text-muted-foreground">
            Sur Chrome Android : menu → « Installer l’application » ou « Ajouter à l’écran
            d’accueil ».
          </p>
          <Button asChild variant="secondary" className="w-full">
            <a href="/?source=pwa">Ouvrir Zandofy</a>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
