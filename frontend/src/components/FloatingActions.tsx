import { useState, useEffect, lazy, Suspense } from "react";
import { ArrowUp, Smartphone, X } from "lucide-react";
import { useUIConfig } from "@/contexts/UIConfigContext";
import { useIsMobile } from "@/hooks/use-mobile";

// QRCode is ~30KB and only needed inside the app-download popup → defer.
const QRCode = lazy(() =>
  import("react-qrcode-logo").then((m) => ({ default: m.QRCode }))
);

export function FloatingActions() {
  const [showScroll, setShowScroll] = useState(false);
  const [appPopup, setAppPopup] = useState(false);
  const { showAppDownloadBanner, showDiscountBadge, discountBadgeText, appPromo } = useUIConfig();
  const isMobile = useIsMobile();

  useEffect(() => {
    const handler = () => setShowScroll(window.scrollY > 400);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);



  return (
    <>
      {/* Sticky vertical discount badge - right side */}
      {showDiscountBadge && (
        <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40">
          <a
            href="#"
            className="block bg-sale text-sale-foreground text-[11px] font-bold py-3 px-1.5 rounded-l-md shadow-lg hover:bg-sale/90 transition-colors"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          >
            {discountBadgeText}
          </a>
        </div>
      )}

      {/* Floating bottom-right buttons — hidden on mobile */}
      {!isMobile && (
        <div className="fixed bottom-20 lg:bottom-6 right-6 z-40 flex flex-col gap-2">
          {showAppDownloadBanner && (
            <button
              onClick={() => setAppPopup(true)}
              className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
              aria-label="Télécharger l'application"
            >
              <Smartphone size={18} />
            </button>
          )}

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
              Scannez le QR code pour installer sur votre mobile
            </p>

            {/* Real QR Code */}
            <div className="flex justify-center mb-2">
              <div className="p-3 bg-background rounded-xl border border-border">
                <Suspense fallback={<div style={{ width: 140, height: 140 }} />}>
                <QRCode
                  value="https://zandofy.com"
                  size={140}
                  qrStyle="dots"
                  eyeRadius={12}
                  logoImage="/favicon.ico"
                  logoWidth={28}
                  logoHeight={28}
                  removeQrCodeBehindLogo
                  ecLevel="M"
                />
                </Suspense>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground text-center mb-4">
              Compatible <span className="font-semibold text-foreground">Android</span> & <span className="font-semibold text-foreground">iOS</span>
            </p>

            {/* Promo code section */}
            {appPromo.enabled && (
              <div className="bg-primary/10 border border-primary/20 rounded-md p-3 text-center">
                <span className="text-[10px] text-muted-foreground">Utilisez le code :</span>
                <div className="text-sm font-bold text-primary tracking-widest mt-0.5">{appPromo.code}</div>
                <span className="text-[10px] text-muted-foreground">
                  pour -{appPromo.discount_pct}% dès ${appPromo.min_order_amount} d'achat
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
