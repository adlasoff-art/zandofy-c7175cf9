import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { RotateCcw, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-destructive/10 text-destructive",
  refunded: "bg-blue-100 text-blue-700",
};

interface Props {
  onOpenDispute?: (returnId: string, orderId: string, storeId: string | null) => void;
}

export function ReturnsList({ onOpenDispute }: Props) {
  const { user } = useAuth();
  const { t, locale, formatPrice } = useI18n();
  const dateLocale = locale === "en" ? enUS : fr;

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ["my-returns", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("return_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;
  }

  if (returns.length === 0) {
    return (
      <div className="text-center py-12">
        <RotateCcw size={32} className="mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">{t("returns.list.empty") || "Aucune demande de retour"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {returns.map(ret => {
        const stClass = STATUS_CLASS[ret.status] || STATUS_CLASS.pending;
        const stLabel = t(`returns.status.${ret.status}`) || t("returns.status.pending");
        const reasonLabel = t(`returns.reason.${ret.reason}`) || ret.reason;
        return (
          <div key={ret.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw size={14} className="text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{reasonLabel}</span>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${stClass}`}>{stLabel}</span>
            </div>
            {ret.description && <p className="text-xs text-muted-foreground">{ret.description}</p>}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{format(new Date(ret.created_at), "dd MMM yyyy", { locale: dateLocale })}</span>
              <span className="font-medium text-foreground">{formatPrice(Number(ret.refund_amount))}</span>
            </div>
            {ret.admin_notes && (
              <p className="text-xs bg-muted/50 rounded p-2 text-muted-foreground">
                <strong>{t("returns.list.adminNote") || "Note admin :"}</strong> {ret.admin_notes}
              </p>
            )}
            {ret.status === "rejected" && onOpenDispute && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => onOpenDispute(ret.id, ret.order_id, ret.store_id)}
              >
                <AlertTriangle size={12} className="mr-1" /> {t("returns.list.openDispute") || "Ouvrir un litige"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
