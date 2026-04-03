import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Truck, Globe, Mail, Phone, Clock, User, ExternalLink, Loader2, ImageIcon } from "lucide-react";

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

export function SupplierPopover({ productId }: { productId: string | null }) {
  const [supplier, setSupplier] = useState<SupplierInfo | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const fetchSupplier = async () => {
    if (supplier !== undefined || !productId) return;
    setLoading(true);
    const { data: product } = await (supabase as any)
      .from("products")
      .select("supplier_id")
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
          <Truck size={13} className="text-primary" />
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
            {/* Product image */}
            {supplier.product_image_url && (
              <div className="w-full h-32 rounded-md overflow-hidden border border-border mb-2">
                <img src={supplier.product_image_url} alt="Produit fournisseur" className="w-full h-full object-cover" />
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
                <a href={supplier.store_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                  {supplier.store_url}
                </a>
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
  const [suppliers, setSuppliers] = useState<Map<string, SupplierInfo | null> | undefined>(undefined);
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
      .select("id, supplier_id")
      .in("id", productIds);

    const supplierIds = [...new Set((products || []).map((p: any) => p.supplier_id).filter(Boolean))];
    
    let suppliersData: SupplierInfo[] = [];
    if (supplierIds.length > 0) {
      const { data } = await (supabase as any)
        .from("suppliers")
        .select("id, agent_name, platform_name, store_url, direct_contact, email, seniority, average_processing_time, product_image_url")
        .in("id", supplierIds);
      suppliersData = data || [];
    }

    const supplierMap = new Map<string, SupplierInfo>();
    suppliersData.forEach(s => supplierMap.set(s.id, s));

    const result = new Map<string, SupplierInfo | null>();
    (products || []).forEach((p: any) => {
      result.set(p.id, p.supplier_id ? supplierMap.get(p.supplier_id) || null : null);
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
          <Truck size={14} className="text-primary" />
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
              const sup = item.product_id ? suppliers.get(item.product_id) : null;
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
                      <div className="flex items-center gap-2 mt-0.5">
                        {sup.product_image_url && (
                          <img src={sup.product_image_url} alt="" className="w-6 h-6 rounded object-cover shrink-0 border border-border" />
                        )}
                        <div>
                          <p className="text-muted-foreground">{sup.agent_name}{sup.platform_name ? ` · ${sup.platform_name}` : ""}</p>
                          {sup.direct_contact && <p className="text-muted-foreground">{sup.direct_contact}</p>}
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
