import { useState } from "react";
import { MessageCircle, ExternalLink, MapPin, Store, ChevronDown, Globe } from "lucide-react";
import { getCountryName } from "@/components/vendor/CountryCombobox";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/VerificationBadge";
import { CertificationBadge } from "@/components/CertificationBadge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { InternalChat } from "@/components/InternalChat";
import { motion, AnimatePresence } from "framer-motion";

interface VendorProfileCardProps {
  store: {
    id: string;
    name: string;
    logo_url?: string | null;
    is_verified?: boolean | null;
    verified_years?: number | null;
    verified_years_override?: number | null;
    created_at?: string | null;
    followers_count?: number | null;
    followers_override?: number | null;
    products_count?: number | null;
    repurchase_rate?: string | null;
    sales_count?: number | null;
    sales_override?: number | null;
    sales_trend?: string | null;
    is_online?: boolean | null;
    whatsapp_number?: string | null;
    is_certified?: boolean | null;
  };
  productName: string;
  productId: string;
  originCountry?: string;
  productSku?: string;
  productPrice?: string;
  productImage?: string;
}

function StatusDot({ isOnline }: { isOnline: boolean }) {
  return (
    <span className="absolute bottom-0 right-0 flex h-3.5 w-3.5 items-center justify-center translate-x-[15%] translate-y-[15%]">
      {isOnline && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      )}
      <span
        className={`relative inline-flex h-3 w-3 rounded-full border-2 border-background ${
          isOnline
            ? "bg-emerald-500 shadow-[0_0_6px_2px_rgba(16,185,129,0.45)]"
            : "bg-amber-500/60"
        }`}
      />
    </span>
  );
}

export function VendorProfileCard({ store, productName, productId, originCountry, productSku, productPrice, productImage }: VendorProfileCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isOnline = store.is_online ?? false;

  // WhatsApp Business URL (uses api.whatsapp.com for Business)
  const productUrl = `${window.location.origin}/product/${productId}`;
  const whatsappUrl = store.whatsapp_number
    ? `https://wa.me/${store.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Bonjour, je suis intéressé par votre produit "${productName}"${productSku ? `\nSKU : ${productSku}` : ""}${productPrice ? `\nPrix : ${productPrice}` : ""}\n${productUrl}`
      )}`
    : null;

  return (
    <div className="border border-border rounded-sm overflow-hidden shadow-sm">
      {/* ─── Row 1: Always visible header ─── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        {/* Avatar + Status LED */}
        <div className="relative shrink-0">
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={store.name}
              className="w-10 h-10 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Store size={16} className="text-primary-foreground" />
            </div>
          )}
          <StatusDot isOnline={isOnline} />
        </div>

        {/* Name + Badge + Origin */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-foreground text-sm truncate">{store.name}</span>
            {store.is_verified && (
              <VerificationBadge variant="icon-only" verifiedYears={store.verified_years_override ?? store.verified_years} storeCreatedAt={store.created_at} />
            )}
            {store.is_certified && (
              <CertificationBadge type="vendor" variant="icon-only" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {originCountry && (
              <span className="inline-flex items-center gap-0.5">
                <Globe size={10} /> Origine : {getCountryName(originCountry)}
              </span>
            )}
            <span className={isOnline ? "text-emerald-600 font-medium" : "text-amber-600"}>
              {isOnline ? "En ligne" : "Hors ligne"}
            </span>
          </div>
        </div>

        {/* Store link + Chevron */}
        <a
          href={`/store/${store.id}`}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 text-primary hover:text-primary/80 transition-colors p-1"
          aria-label="Visiter la boutique"
        >
          <ExternalLink size={14} />
        </a>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>

      {/* ─── Expandable zone with framer-motion ─── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="vendor-expand"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {store.products_count != null && (
                  <div className="bg-muted/50 rounded-sm py-1.5">
                    <span className="font-semibold text-foreground block">{store.products_count.toLocaleString()}</span>
                    <span className="text-muted-foreground">Articles</span>
                  </div>
                )}
                <div className="bg-muted/50 rounded-sm py-1.5">
                  <span className="font-semibold text-foreground block">
                    {(() => {
                      const followers = store.followers_override ?? store.followers_count ?? 0;
                      return followers >= 1000 ? `${(followers / 1000).toFixed(0)}K` : followers;
                    })()}
                  </span>
                  <span className="text-muted-foreground">Abonnés</span>
                </div>
                <div className="bg-muted/50 rounded-sm py-1.5">
                  <span className="font-semibold text-foreground block">{store.sales_override ?? store.sales_count ?? 0}</span>
                  <span className="text-muted-foreground">Vendus</span>
                </div>
              </div>

              {/* Dual CTA */}
              <div className="grid grid-cols-2 gap-2">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
                      <MessageCircle size={14} />
                      Contacter
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
                    <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
                      <SheetTitle className="flex items-center gap-2">
                        <MessageCircle size={18} /> Chat avec {store.name}
                      </SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-hidden">
                      <InternalChat
                        storeId={store.id}
                        storeName={store.name}
                        productId={productId}
                        productName={productName}
                        productImage={productImage}
                        productPrice={productPrice}
                      />
                    </div>
                  </SheetContent>
                </Sheet>

                {whatsappUrl ? (
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button
                      size="sm"
                      className="w-full text-xs gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white border-0"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      WhatsApp
                    </Button>
                  </a>
                ) : (
                  <Button variant="secondary" size="sm" className="w-full text-xs gap-1.5" disabled>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
