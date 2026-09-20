import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Store, Globe, Mail, Phone, Clock, User, ExternalLink, Loader2, ImageIcon, Link, Copy } from "lucide-react";
import { toast } from "sonner";

function truncateMiddle(url: string, max = 40): string {
  if (url.length <= max) return url;
  const keep = Math.floor((max - 1) / 2);
  return `${url.slice(0, keep)}…${url.slice(-keep)}`;
}

function TruncatedCopyUrl({ url, label }: { url: string; label?: string }) {
  const safe =
    typeof url === "string" &&
    (url.startsWith("https://") || url.startsWith("http://"));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien copié");
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <div className="flex items-center gap-1.5 min-w-0 flex-1">
      {safe ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline truncate min-w-0"
          title={url}
        >
          {label ? `${label} · ${truncateMiddle(url)}` : truncateMiddle(url)}
        </a>
      ) : (
        <span className="text-muted-foreground truncate min-w-0" title={url}>
          {label ? `${label} · ${truncateMiddle(url)}` : truncateMiddle(url)}
        </span>
      )}
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); void copy(); }}
        className="p-0.5 rounded hover:bg-muted shrink-0 text-muted-foreground hover:text-foreground"
        title="Copier le lien"
      >
        <Copy size={11} />
      </button>
    </div>
  );
}

interface SupplierInfo {
  id: string;
  agent_name: string;
  platform_name: string;
  store_url: string | null;
  direct_contact: string | null;
  email: string;
  seniority: string | null;
  average_processing_time: string | null;
  product_image_url: string | null;
}

interface SupplierProductInfo {
  id: string;
  label: string;
  product_url: string | null;
  image_url: string | null;
}

export function SupplierPopover({ productId }: { productId: string | null }) {
  const [supplier, setSupplier] = useState<SupplierInfo | null | undefined>(undefined);
  const [supplierProduct, setSupplierProduct] = useState<SupplierProductInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSupplier = async () => {
    if (supplier !== undefined || !productId) return;
    setLoading(true);
    const { data: product } = await (supabase as any)
      .from("products")
      .select("supplier_id, supplier_product_id")
      .eq("id", productId)
      .maybeSingle();

    if (!product?.supplier_id) {
      setSupplier(null);
      setLoading(false);
      return;
    }

    const { data } = await (supabase as any)
      .from("suppliers")
      .select("id, agent_name, platform_name, store_url, direct_contact, email, seniority, average_processing_time, product_image_url")
      .eq("id", product.supplier_id)
      .maybeSingle();

    setSupplier(data || null);

    // Load linked supplier product if any
    if (product.supplier_product_id) {
      const { data: spData } = await (supabase as any)
        .from("supplier_products")
        .select("id, label, product_url, image_url")
        .eq("id", product.supplier_product_id)
        .maybeSingle();
      setSupplierProduct(spData || null);
    }

    setLoading(false);
  };

  if (!productId) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={fetchSupplier}
          className="p-1 rounded hover:bg-muted transition-colors"
          title="Voir fournisseur"
        >
          <Store size={13} className="text-primary" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        {loading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 size={16} className="animate-spin text-primary" />
          </div>
        ) : supplier === null ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Aucun fournisseur lié à ce produit.
          </p>
        ) : supplier ? (
          <div className="space-y-2">
            {/* Supplier product image or fallback to supplier avatar */}
            {(supplierProduct?.image_url || supplier.product_image_url) && (
              <div className="w-full h-32 rounded-md overflow-hidden border border-border mb-2">
                <img src={supplierProduct?.image_url || supplier.product_image_url!} alt="Produit fournisseur" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex items-center gap-2 pb-1 border-b border-border">
              <User size={14} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">{supplier.agent_name}</span>
            </div>
            {supplier.platform_name && (
              <InfoRow icon={Globe} label="Plateforme" value={supplier.platform_name} />
            )}
            {supplier.store_url && (
              <div className="flex items-start gap-2 text-xs">
                <ExternalLink size={11} className="text-muted-foreground mt-0.5 shrink-0" />
                <TruncatedCopyUrl url={supplier.store_url} label="Boutique" />
              </div>
            )}
            {/* Supplier product link */}
            {supplierProduct?.product_url && (
              <div className="flex items-start gap-2 text-xs">
                <Link size={11} className="text-muted-foreground mt-0.5 shrink-0" />
                <TruncatedCopyUrl
                  url={supplierProduct.product_url}
                  label={supplierProduct.label || "Produit"}
                />
              </div>
            )}

            {supplier.email && (
              <InfoRow icon={Mail} label="Email" value={supplier.email} />
            )}
            {supplier.direct_contact && (
              <InfoRow icon={Phone} label="Contact" value={supplier.direct_contact} />
            )}
            {supplier.seniority && (
              <InfoRow icon={User} label="Ancienneté" value={supplier.seniority} />
            )}
            {supplier.average_processing_time && (
              <InfoRow icon={Clock} label="Délai" value={supplier.average_processing_time} />
            )}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** Popover that shows suppliers for all items in an order */
export function OrderSuppliersPopover({ items }: { items: { product_id: string | null; product_name: string; product_image: string | null }[] }) {
  const [suppliers, setSuppliers] = useState<Map<string, { supplier: SupplierInfo | null; supplierProduct: SupplierProductInfo | null }> | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    if (suppliers !== undefined) return;
    setLoading(true);
    const productIds = items.map(i => i.product_id).filter(Boolean) as string[];
    if (productIds.length === 0) {
      setSuppliers(new Map());
      setLoading(false);
      return;
    }

    const { data: products } = await (supabase as any)
      .from("products")
      .select("id, supplier_id, supplier_product_id")
      .in("id", productIds);

    const supplierIds = [...new Set((products || []).map((p: any) => p.supplier_id).filter(Boolean))];
    const supplierProductIds = [...new Set((products || []).map((p: any) => p.supplier_product_id).filter(Boolean))];
    
    let suppliersData: SupplierInfo[] = [];
    if (supplierIds.length > 0) {
      const { data } = await (supabase as any)
        .from("suppliers")
        .select("id, agent_name, platform_name, store_url, direct_contact, email, seniority, average_processing_time, product_image_url")
        .in("id", supplierIds);
      suppliersData = data || [];
    }

    let supplierProductsData: (SupplierProductInfo & { supplier_id?: string })[] = [];
    if (supplierProductIds.length > 0) {
      const { data } = await (supabase as any)
        .from("supplier_products")
        .select("id, label, product_url, image_url")
        .in("id", supplierProductIds);
      supplierProductsData = data || [];
    }

    const supplierMap = new Map<string, SupplierInfo>();
    suppliersData.forEach(s => supplierMap.set(s.id, s));

    const spMap = new Map<string, SupplierProductInfo>();
    supplierProductsData.forEach(sp => spMap.set(sp.id, sp));

    const result = new Map<string, { supplier: SupplierInfo | null; supplierProduct: SupplierProductInfo | null }>();
    (products || []).forEach((p: any) => {
      result.set(p.id, {
        supplier: p.supplier_id ? supplierMap.get(p.supplier_id) || null : null,
        supplierProduct: p.supplier_product_id ? spMap.get(p.supplier_product_id) || null : null,
      });
    });

    setSuppliers(result);
    setLoading(false);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={fetchAll}
          className="p-1 rounded hover:bg-muted transition-colors"
          title="Fournisseurs de cette commande"
        >
          <Store size={14} className="text-primary" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 max-h-96 overflow-y-auto" align="start">
        {loading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 size={16} className="animate-spin text-primary" />
          </div>
        ) : suppliers && suppliers.size === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Aucun fournisseur lié.
          </p>
        ) : suppliers ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground border-b border-border pb-1">Fournisseurs par produit</p>
            {items.map((item, idx) => {
              const entry = item.product_id ? suppliers.get(item.product_id) : null;
              const sup = entry?.supplier;
              const sp = entry?.supplierProduct;
              return (
                <div key={idx} className="flex items-start gap-2 text-xs border-b border-border pb-2 last:border-0">
                  {/* Product thumbnail */}
                  <div className="w-8 h-8 rounded overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                    {item.product_image ? (
                      <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={12} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{item.product_name}</p>
                    {sup ? (
                      <div className="flex items-start gap-2 mt-0.5">
                        {(sp?.image_url || sup.product_image_url) && (
                          <img src={sp?.image_url || sup.product_image_url!} alt="" className="w-6 h-6 rounded object-cover shrink-0 border border-border" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-muted-foreground">{sup.agent_name}{sup.platform_name ? ` · ${sup.platform_name}` : ""}</p>
                          {sup.direct_contact && <p className="text-muted-foreground">{sup.direct_contact}</p>}
                          {sup.store_url && (
                            <div className="flex items-center gap-1 mt-0.5 min-w-0">
                              <ExternalLink size={10} className="shrink-0 text-muted-foreground" />
                              <TruncatedCopyUrl url={sup.store_url} label="Boutique" />
                            </div>
                          )}
                          {sp?.product_url && (
                            <div className="flex items-center gap-1 mt-0.5 min-w-0">
                              <Link size={10} className="shrink-0 text-muted-foreground" />
                              <TruncatedCopyUrl url={sp.product_url} label={sp.label || "Produit"} />
                            </div>
                          )}

                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground/60 italic">Aucun fournisseur</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon size={11} className="text-muted-foreground mt-0.5 shrink-0" />
      <span className="text-muted-foreground shrink-0">{label} :</span>
      <span className="text-foreground break-all">{value}</span>
    </div>
  );
}
