import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDiscoveryPrefs } from "@/contexts/DiscoveryPrefsContext";
import { useAuthSettings } from "@/hooks/use-auth-settings";
import { isDiscoverySnoozed } from "@/lib/discovery-prefs";
import { isDiscoverySheetOpen, subscribeDiscoverySheetOpen } from "@/lib/discovery-sheet-bus";
import { fetchFlashSaleProducts, fetchProducts, type Product } from "@/services/api";
import {
  assembleDiscoveryFeed,
  expandApparelCategoryIds,
  expandInterestCategoryIds,
  EMPTY_CATEGORY_TREE,
} from "@/lib/discovery-engine";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { imgUrl } from "@/lib/image-url";
import { useI18n } from "@/contexts/I18nContext";

function welcomeSeenKey(userId: string) {
  return `zandofy_welcome_seen_${userId}`;
}

/**
 * One-shot welcome after discovery completed — Discovery-ranked promo slice.
 */
export function WelcomeDiscoveryDialog() {
  const { user } = useAuth();
  const { prefs, hasCompleted } = useDiscoveryPrefs();
  const { data: authSettings } = useAuthSettings();
  const { t, formatPrice } = useI18n();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  const { data: categoryTree = EMPTY_CATEGORY_TREE } = useQuery({
    queryKey: ["discovery-category-tree"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("id, parent_id, apparel_fields_enabled")
        .limit(2000);
      if (error) throw error;
      return data || EMPTY_CATEGORY_TREE;
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!user && hasCompleted,
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!user || !hasCompleted) return;
    if (isDiscoverySnoozed() && !hasCompleted) return;
    try {
      if (localStorage.getItem(welcomeSeenKey(user.id))) return;
    } catch {
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const delaySec = authSettings?.discovery_popup_delay_sec ?? 15;

    const run = async () => {
      if (isDiscoverySheetOpen()) return;
      try {
        const [flash, popular] = await Promise.all([
          fetchFlashSaleProducts({}).catch(() => [] as Product[]),
          fetchProducts({ limit: 48, orderBy: "popular" }),
        ]);
        const pool = [...flash, ...popular];
        const seen = new Set<string>();
        const unique = pool.filter((p) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
        const ranked = assembleDiscoveryFeed(unique, {
          prefs,
          mix: authSettings?.discovery_mix,
          take: 8,
          interestCategoryIds: expandInterestCategoryIds(prefs.interest_category_ids, categoryTree),
          apparelCategoryIds: expandApparelCategoryIds(categoryTree),
          surface: "welcome_dialog",
          seedKey: user.id,
        });
        // Prefer sale/promo items when present
        const promoFirst = [
          ...ranked.filter((p) => (p.discount && p.discount > 0) || p.promoEndDate || p.isSale),
          ...ranked.filter((p) => !((p.discount && p.discount > 0) || p.promoEndDate || p.isSale)),
        ].slice(0, 6);
        if (promoFirst.length === 0) return;
        setProducts(promoFirst);
        setOpen(true);
      } catch (e) {
        console.warn("[WelcomeDiscoveryDialog]", e);
      }
    };

    const schedule = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        if (isDiscoverySheetOpen()) return;
        void run();
      }, delaySec * 1000);
    };

    if (isDiscoverySheetOpen()) {
      return subscribeDiscoverySheetOpen((sheetOpen) => {
        if (!sheetOpen) schedule();
      });
    }
    schedule();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [user?.id, hasCompleted, prefs, authSettings?.discovery_mix, authSettings?.discovery_popup_delay_sec, categoryTree]);

  const handleClose = () => {
    setOpen(false);
    if (user) {
      try {
        localStorage.setItem(welcomeSeenKey(user.id), "1");
      } catch {
        /* ignore */
      }
    }
  };

  if (!products.length) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("welcome.discoveryTitle") || "Bienvenue — sélection pour vous"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("welcome.discoveryDesc") ||
            "D’après vos préférences, voici des articles et promos à découvrir."}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
          {products.map((p) => (
            <Link
              key={p.id}
              to={`/product/${p.slug || p.id}`}
              onClick={handleClose}
              className="group block rounded-sm border border-border overflow-hidden hover:border-primary transition-colors"
            >
              <div className="aspect-square bg-muted relative">
                <img
                  src={imgUrl(p.image || "", { width: 240, height: 240, resize: "cover" })}
                  alt={p.nameFr || p.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-2 space-y-0.5">
                <p className="text-xs font-medium line-clamp-2 text-foreground group-hover:text-primary">
                  {p.nameFr || p.name}
                </p>
                <p className="text-xs font-bold">{formatPrice(p.price)}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <Button asChild variant="outline" className="flex-1" onClick={handleClose}>
            <Link to="/super-promo">{t("welcome.seePromos") || "Voir les promos"}</Link>
          </Button>
          <Button className="flex-1" onClick={handleClose}>
            {t("welcome.continue") || "Continuer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
