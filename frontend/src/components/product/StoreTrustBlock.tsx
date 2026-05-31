import { useState } from "react";
import { Globe, MessageCircle, Store } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { InternalChat } from "@/components/InternalChat";
import { VerificationBadge } from "@/components/VerificationBadge";
import { getCountryName } from "@/components/vendor/CountryCombobox";
import { useAuth } from "@/contexts/AuthContext";
import { openStoreWhatsApp } from "@/lib/whatsapp";
import { imgUrl } from "@/lib/image-url";
import { storeYearsLabel } from "@/lib/product-pdp";

export type StoreTrustData = {
  id: string;
  name: string;
  logo_url?: string | null;
  is_verified?: boolean | null;
  verified_years?: number | null;
  verified_years_override?: number | null;
  created_at?: string | null;
  rating?: number | null;
  response_time?: string | null;
  response_rate?: string | null;
  repurchase_rate?: string | null;
};

type Props = {
  store: StoreTrustData;
  originCountry?: string;
  productId: string;
  productName: string;
  productSku?: string;
  productPrice?: string;
  labels: {
    storeRating: string;
    storeResponseTime: string;
    storeReactivity: string;
    storeReorderRate: string;
    contactSupplier: string;
    whatsapp: string;
    visitStore: string;
  };
};

function KpiCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-sm p-2 text-center min-h-[52px] flex flex-col justify-center">
      <span className="text-sm font-semibold text-foreground leading-tight">{value}</span>
      <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</span>
    </div>
  );
}

export function StoreTrustBlock({
  store,
  originCountry,
  productId,
  productName,
  productSku,
  productPrice,
  labels,
}: Props) {
  const { user } = useAuth();
  const [whatsappLoading, setWhatsappLoading] = useState(false);

  const years = storeYearsLabel(store);
  const originLine = [
    originCountry ? getCountryName(originCountry) : null,
    years,
  ]
    .filter(Boolean)
    .join(" · ");

  const productUrl = typeof window !== "undefined" ? `${window.location.origin}/product/${productId}` : "";
  const whatsappMessage = `Bonjour, je suis intéressé par votre produit "${productName}"${productSku ? `\nSKU : ${productSku}` : ""}${productPrice ? `\nPrix : ${productPrice}` : ""}\n${productUrl}`;

  const handleWhatsApp = async () => {
    if (whatsappLoading || !user) return;
    setWhatsappLoading(true);
    try {
      await openStoreWhatsApp(store.id, whatsappMessage);
    } finally {
      setWhatsappLoading(false);
    }
  };

  return (
    <div className="border border-border rounded-sm p-3 space-y-3 bg-card shadow-sm">
      <div className="flex items-start gap-3">
        {store.logo_url ? (
          <img
            src={imgUrl(store.logo_url, { width: 96 })}
            alt={store.name}
            className="w-12 h-12 rounded-full object-cover border border-border shrink-0"
            loading="lazy"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shrink-0">
            <Store size={20} className="text-primary-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link to={`/store/${store.id}`} className="font-semibold text-sm text-foreground hover:text-primary truncate">
              {store.name}
            </Link>
            {store.is_verified && (
              <VerificationBadge
                variant="icon-only"
                verifiedYears={store.verified_years_override ?? store.verified_years}
                storeCreatedAt={store.created_at}
              />
            )}
          </div>
          {originLine && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Globe size={10} className="shrink-0" />
              {originLine}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <KpiCell
          label={labels.storeRating}
          value={store.rating != null ? `${Number(store.rating).toFixed(1)}/5` : "—"}
        />
        <KpiCell
          label={labels.storeResponseTime}
          value={store.response_time?.trim() || "—"}
        />
        <KpiCell
          label={labels.storeReactivity}
          value={store.response_rate?.trim() || "—"}
        />
        <KpiCell
          label={labels.storeReorderRate}
          value={store.repurchase_rate?.trim() || "—"}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 min-h-[44px]">
              <MessageCircle size={14} />
              {labels.contactSupplier}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
            <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
              <SheetTitle className="flex items-center gap-2 text-base">
                <MessageCircle size={18} /> Chat — {store.name}
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">
              <InternalChat storeId={store.id} storeName={store.name} productId={productId} />
            </div>
          </SheetContent>
        </Sheet>
        <Button
          type="button"
          size="sm"
          className="w-full text-xs gap-1.5 min-h-[44px] bg-[#25D366] hover:bg-[#20bd5a] text-white"
          disabled={!user || whatsappLoading}
          onClick={handleWhatsApp}
        >
          {labels.whatsapp}
        </Button>
      </div>
    </div>
  );
}
