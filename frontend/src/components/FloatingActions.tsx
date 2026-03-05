import { useState, useEffect } from "react";
import { ArrowUp, Smartphone, X } from "lucide-react";
import { useUIConfig } from "@/contexts/UIConfigContext";
import { useIsMobile } from "@/hooks/use-mobile";

export function FloatingActions() {
  const [showScroll, setShowScroll] = useState(false);
  const [appPopup, setAppPopup] = useState(false);
  const { showAppDownloadBanner, showDiscountBadge } = useUIConfig();
  const isMobile = useIsMobile();

  useEffect(() => {
    const handler = () => setShowScroll(window.scrollY > 400);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <>
      {/* Sticky vertical "Get 20% OFF" badge - right side */}
      {showDiscountBadge && (
        <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40">
          <a
            href="#"
            className="block bg-sale text-sale-foreground text-[11px] font-bold py-3 px-1.5 rounded-l-md shadow-lg hover:bg-sale/90 transition-colors"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          >
            Get 20% OFF
          </a>
        </div>
      )}

      {/* Floating bottom-right buttons — hidden on mobile */}
      {!isMobile && (
      <div className="fixed bottom-20 lg:bottom-6 right-6 z-40 flex flex-col gap-2">
        {/* App download */}
        {showAppDownloadBanner && (
          <button
            onClick={() => setAppPopup(true)}
            className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
            aria-label="Télécharger l'application"
          >
            <Smartphone size={18} />
          </button>
        )}

        {/* Scroll to top */}
        {showScroll && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="w-10 h-10 bg-foreground text-card rounded-full flex items-center justify-center shadow-lg hover:bg-foreground/90 transition-colors animate-fade-in"
            aria-label="Retour en haut"
          >
            <ArrowUp size={18} />
          </button>
        )}
      </div>
      )}

      {/* App Download Popup */}
      {appPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50" onClick={() => setAppPopup(false)}>
          <div className="bg-card rounded-lg shadow-xl p-6 w-80 relative animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setAppPopup(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            >
              <X size={18} />
            </button>

            <h3 className="text-base font-bold text-foreground text-center mb-2">
              Téléchargez l'App Zandofy
            </h3>
            <p className="text-xs text-muted-foreground text-center mb-4">
              Profitez d'offres exclusives sur mobile
            </p>

            {/* QR Code placeholder */}
            <div className="w-32 h-32 mx-auto bg-muted border border-border rounded-lg flex items-center justify-center mb-4">
              <div className="text-center">
                <Smartphone size={32} className="text-primary mx-auto mb-1" />
                <span className="text-[10px] text-muted-foreground">Scannez le QR</span>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <button className="flex-1 py-2 text-[11px] font-bold bg-foreground text-card rounded-md hover:bg-foreground/90 transition-colors">
                Android
              </button>
              <button className="flex-1 py-2 text-[11px] font-bold bg-foreground text-card rounded-md hover:bg-foreground/90 transition-colors">
                iOS
              </button>
            </div>

            {/* Discount code */}
            <div className="bg-primary/10 border border-primary/20 rounded-md p-3 text-center">
              <span className="text-[10px] text-muted-foreground">Utilisez le code :</span>
              <div className="text-sm font-bold text-primary tracking-widest mt-0.5">APP20</div>
              <span className="text-[10px] text-muted-foreground">pour -20% sur l'app</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
