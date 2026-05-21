/**
 * ForwarderShippingCopyBlock — Vendeur/Admin only.
 *
 * Affiche deux blocs copiables en un clic :
 *  1. "Infos à coller sur le colis" (gabarit avec placeholders résolus)
 *  2. "Adresse entrepôt transitaire" (warehouse_address brut)
 *
 * RLS: la table forwarder_shipping_templates n'autorise la lecture qu'aux
 * admin/manager/vendeurs (propriétaires de boutique). Le client final ne
 * verra jamais ce composant car il n'est monté que dans FreightDetailsPanel
 * lorsque `actor` est défini (vendor/admin).
 */

import { useEffect, useMemo, useState } from "react";
import { Copy, Package2, Warehouse, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Template {
  id: string;
  label: string;
  warehouse_address: string;
  package_info_template: string;
  is_default: boolean;
  sort_order: number;
}

interface CustomerCtx {
  customer_name: string;
  phone: string;
  city: string;
  country: string;
  order_ref: string;
}

function resolveTemplate(tpl: string, ctx: CustomerCtx): string {
  return tpl
    .replace(/\{\{customer_name\}\}/g, ctx.customer_name || "")
    .replace(/\{\{phone\}\}/g, ctx.phone || "")
    .replace(/\{\{city\}\}/g, ctx.city || "")
    .replace(/\{\{country\}\}/g, ctx.country || "")
    .replace(/\{\{order_ref\}\}/g, ctx.order_ref || "");
}

export function ForwarderShippingCopyBlock({
  forwarderId,
  customer,
}: {
  forwarderId: string;
  customer: CustomerCtx;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("forwarder.copy.copied") || "Copié dans le presse-papier");
    } catch {
      toast.error(t("forwarder.copy.copyFail") || "Copie impossible");
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await (supabase as any)
        .from("forwarder_shipping_templates")
        .select("id, label, warehouse_address, package_info_template, is_default, sort_order")
        .eq("forwarder_id", forwarderId)
        .order("sort_order", { ascending: true });
      if (cancelled) return;
      if (error) {
        setTemplates([]);
      } else {
        const rows = (data ?? []) as Template[];
        setTemplates(rows);
        const def = rows.find((r) => r.is_default) ?? rows[0];
        setSelectedId(def?.id ?? null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [forwarderId]);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  const resolvedPackageInfo = useMemo(
    () => (selected ? resolveTemplate(selected.package_info_template, customer) : ""),
    [selected, customer],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-2">
        <Loader2 size={12} className="animate-spin text-primary" />
        {t("forwarder.copy.loading") || "Chargement des modèles d'expédition…"}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="px-2.5 py-1.5 rounded-md border border-dashed border-border text-[11px] text-muted-foreground">
        {t("forwarder.copy.empty") || "Aucun modèle d'expédition configuré pour ce transitaire. Demandez à un administrateur d'en créer un."}
      </div>
    );
  }

  if (!selected) return null;

  const fullText = `${resolvedPackageInfo}\n\n${t("forwarder.copy.warehouseHeader") || "— Entrepôt —"}\n${selected.warehouse_address}`;

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
          <Package2 size={12} className="text-primary" />
          {t("forwarder.copy.title") || "Bloc expédition transitaire"}
          <span className="text-muted-foreground font-normal">{t("forwarder.copy.vendorOnly") || "(vendeur uniquement)"}</span>
        </p>
        {templates.length > 1 && (
          <Select value={selectedId ?? ""} onValueChange={(v) => setSelectedId(v)}>
            <SelectTrigger className="h-7 text-[11px] w-[180px]">
              <SelectValue placeholder={t("forwarder.copy.selectPlaceholder") || "Choisir un entrepôt"} />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-[11px]">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Infos colis */}
        <div className="rounded-md border border-border bg-background/60 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("forwarder.copy.packageInfoLabel") || "Infos à coller sur le colis"}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px]"
              onClick={() => copyToClipboard(resolvedPackageInfo)}
            >
              <Copy size={10} className="mr-1" /> {t("forwarder.copy.copy") || "Copier"}
            </Button>
          </div>
          <pre className="whitespace-pre-wrap text-[11px] text-foreground font-mono leading-snug">
            {resolvedPackageInfo}
          </pre>
        </div>

        {/* Adresse entrepôt */}
        <div className="rounded-md border border-border bg-background/60 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Warehouse size={10} /> {t("forwarder.copy.warehouseLabel") || "Adresse entrepôt transitaire"}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px]"
              onClick={() => copyToClipboard(selected.warehouse_address)}
            >
              <Copy size={10} className="mr-1" /> {t("forwarder.copy.copy") || "Copier"}
            </Button>
          </div>
          <pre className="whitespace-pre-wrap text-[11px] text-foreground font-mono leading-snug">
            {selected.warehouse_address}
          </pre>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          onClick={() => copyToClipboard(fullText)}
        >
          <Copy size={11} className="mr-1.5" /> {t("forwarder.copy.copyAll") || "Tout copier"}
        </Button>
      </div>
    </div>
  );
}