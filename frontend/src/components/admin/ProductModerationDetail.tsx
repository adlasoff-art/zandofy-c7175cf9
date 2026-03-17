import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PUBLISH_STATUS_CONFIG } from "@/lib/vendor-tiers";
import { Loader2, Package, Store, Tag, Ruler, Weight, MapPin, Star, Image as ImageIcon, Palette, LayoutGrid, DollarSign, AlertTriangle, Link as LinkIcon } from "lucide-react";

interface Props {
  productId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductModerationDetail({ productId, open, onOpenChange }: Props) {
  const { data: product, isLoading } = useQuery({
    queryKey: ["admin-product-detail", productId],
    enabled: !!productId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_images(id, image_url, position), product_colors(id, color_hex, color_name, image_url), product_sizes(id, size_label, region, bust_cm, waist_cm, hips_cm), product_pricing_tiers(id, tier_label, min_quantity, discount_type, discount_value)")
        .eq("id", productId!)
        .single();
      if (error) throw error;

      // Fetch store name
      let storeName = "—";
      if (data.store_id) {
        const { data: store } = await supabase.from("stores").select("name").eq("id", data.store_id).single();
        if (store) storeName = store.name;
      }

      // Fetch category name
      let categoryName = "—";
      if (data.category_id) {
        const { data: cat } = await supabase.from("categories").select("name_fr").eq("id", data.category_id).single();
        if (cat) categoryName = cat.name_fr;
      }

      return { ...data, store_name: storeName, category_name: categoryName };
    },
  });

  const statusCfg = product ? (PUBLISH_STATUS_CONFIG[product.publish_status] || PUBLISH_STATUS_CONFIG.draft) : null;
  const images = (product?.product_images || []).sort((a: any, b: any) => (a.position ?? 99) - (b.position ?? 99));
  const colors = product?.product_colors || [];
  const sizes = product?.product_sizes || [];
  const tiers = product?.product_pricing_tiers || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package size={18} className="text-primary" />
            Détails du produit
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : !product ? (
          <p className="text-center text-muted-foreground py-8">Produit introuvable.</p>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">{product.name_fr}</h2>
                {product.name !== product.name_fr && (
                  <p className="text-sm text-muted-foreground">{product.name}</p>
                )}
              </div>
              {statusCfg && (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusCfg.badgeClass}`}>
                  {statusCfg.label}
                </span>
              )}
            </div>

            {/* Previous moderation reason */}
            {product.moderation_reason && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                  <AlertTriangle size={14} />
                  Dernière raison de modération
                </div>
                <p className="text-sm text-foreground">{product.moderation_reason}</p>
                {product.moderation_reason_link && (
                  <a href={product.moderation_reason_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <LinkIcon size={12} /> Voir le règlement
                  </a>
                )}
              </div>
            )}

            {/* Images */}
            <Section title="Photos" icon={<ImageIcon size={14} />}>
              {images.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Aucune photo</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((img: any) => (
                    <img key={img.id} src={img.image_url} alt="" className="w-full h-24 object-cover rounded-md border border-border" />
                  ))}
                </div>
              )}
            </Section>

            {/* Key info */}
            <Section title="Informations clés" icon={<Tag size={14} />}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <InfoItem label="Boutique" value={product.store_name} icon={<Store size={12} />} />
                <InfoItem label="Catégorie" value={product.category_name} icon={<LayoutGrid size={12} />} />
                <InfoItem label="Prix" value={`${product.price} ${product.currency}`} icon={<DollarSign size={12} />} />
                {product.original_price && <InfoItem label="Prix original" value={`${product.original_price} ${product.currency}`} />}
                {product.discount != null && product.discount > 0 && <InfoItem label="Réduction" value={`${product.discount}%`} />}
                <InfoItem label="MOQ" value={String(product.moq ?? 1)} />
                <InfoItem label="SKU" value={product.sku || "—"} />
                <InfoItem label="Stock" value={product.stock_quantity != null ? String(product.stock_quantity) : "—"} />
                <InfoItem label="Matière" value={product.material || "—"} />
                <InfoItem label="Style" value={product.style || "—"} />
                <InfoItem label="Pays d'origine" value={product.origin_country || "—"} icon={<MapPin size={12} />} />
                <InfoItem label="Avis" value={`${product.rating ?? 0}★ (${product.review_count ?? 0})`} icon={<Star size={12} />} />
              </div>
            </Section>

            {/* Dimensions */}
            {(product.weight_grams || product.length_cm || product.width_cm || product.height_cm) && (
              <Section title="Dimensions / Poids" icon={<Ruler size={14} />}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  {product.weight_grams && <InfoItem label="Poids" value={`${product.weight_grams}g`} icon={<Weight size={12} />} />}
                  {product.length_cm && <InfoItem label="Longueur" value={`${product.length_cm} cm`} />}
                  {product.width_cm && <InfoItem label="Largeur" value={`${product.width_cm} cm`} />}
                  {product.height_cm && <InfoItem label="Hauteur" value={`${product.height_cm} cm`} />}
                </div>
              </Section>
            )}

            {/* Description */}
            <Section title="Description" icon={<Tag size={14} />}>
              {product.short_description && (
                <p className="text-sm text-muted-foreground mb-2 italic">{product.short_description}</p>
              )}
              {product.description ? (
                <div className="text-sm text-foreground prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: product.description }} />
              ) : (
                <p className="text-sm text-muted-foreground italic">Aucune description</p>
              )}
            </Section>

            {/* Colors */}
            {colors.length > 0 && (
              <Section title="Couleurs" icon={<Palette size={14} />}>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1 text-xs">
                      <span className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: c.color_hex }} />
                      {c.color_name}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Sizes */}
            {sizes.length > 0 && (
              <Section title="Tailles" icon={<Ruler size={14} />}>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s: any) => (
                    <Badge key={s.id} variant="outline" className="text-xs">
                      {s.size_label}{s.region ? ` (${s.region})` : ""}
                    </Badge>
                  ))}
                </div>
              </Section>
            )}

            {/* Pricing tiers */}
            {tiers.length > 0 && (
              <Section title="Paliers de prix" icon={<DollarSign size={14} />}>
                <div className="space-y-1">
                  {tiers.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between text-sm bg-muted rounded-md px-3 py-1.5">
                      <span className="font-medium">{t.tier_label}</span>
                      <span className="text-muted-foreground">
                        ≥ {t.min_quantity} pcs → {t.discount_type === "percentage" ? `-${t.discount_value}%` : `-${t.discount_value} ${product.currency}`}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* SEO */}
            {(product.meta_title || product.meta_description) && (
              <Section title="SEO" icon={<Tag size={14} />}>
                <div className="text-sm space-y-1">
                  {product.meta_title && <p><strong>Meta title :</strong> {product.meta_title}</p>}
                  {product.meta_description && <p><strong>Meta description :</strong> {product.meta_description}</p>}
                  {product.seo_keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {product.seo_keywords.map((kw: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{kw}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Promo */}
            {(product.is_sale || product.flash_timer_enabled) && (
              <Section title="Promotion" icon={<Tag size={14} />}>
                <div className="text-sm space-y-1">
                  {product.is_sale && <Badge variant="destructive" className="text-[10px]">En promotion</Badge>}
                  {product.flash_timer_enabled && <Badge className="text-[10px] bg-orange-500">Flash Timer actif ({product.flash_timer_duration_hours}h)</Badge>}
                  {product.promo_start_date && <p>Début : {new Date(product.promo_start_date).toLocaleDateString("fr-FR")}</p>}
                  {product.promo_end_date && <p>Fin : {new Date(product.promo_end_date).toLocaleDateString("fr-FR")}</p>}
                </div>
              </Section>
            )}

            <p className="text-[10px] text-muted-foreground text-right">
              Créé le {new Date(product.created_at).toLocaleString("fr-FR")} — Mis à jour le {new Date(product.updated_at).toLocaleString("fr-FR")}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function InfoItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
