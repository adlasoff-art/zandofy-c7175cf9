import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Truck, Globe, Mail, Phone, Clock, User, ExternalLink, Loader2 } from "lucide-react";

interface SupplierInfo {
  id: string;
  agent_name: string;
  platform_name: string;
  store_url: string | null;
  direct_contact: string | null;
  email: string;
  seniority: string | null;
  average_processing_time: string | null;
}

export function SupplierPopover({ productId }: { productId: string | null }) {
  const [supplier, setSupplier] = useState<SupplierInfo | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const fetchSupplier = async () => {
    if (supplier !== undefined || !productId) return;
    setLoading(true);
    // Get supplier_id from product, then fetch supplier
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
      .select("id, agent_name, platform_name, store_url, direct_contact, email, seniority, average_processing_time")
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

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon size={11} className="text-muted-foreground mt-0.5 shrink-0" />
      <span className="text-muted-foreground shrink-0">{label} :</span>
      <span className="text-foreground break-all">{value}</span>
    </div>
  );
}
