import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_CTA_URL,
  interpolateOutreach,
  templateSupportsChannel,
  type UtilityMessageTemplate,
} from "@/lib/outreach-templates";
import { normalizeWhatsAppDigits, openWhatsAppWithDigits } from "@/lib/whatsapp";

const RATE_LIMIT_PER_HOUR = 30;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    phone_e164?: string | null;
  } | null;
};

export function AdminUserWhatsAppDialog({ open, onOpenChange, user }: Props) {
  const { user: admin } = useAuth();
  const [templateId, setTemplateId] = useState<string>("");
  const [sending, setSending] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["utility-message-templates-wame"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("utility_message_templates")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return ((data || []) as UtilityMessageTemplate[]).filter((t) =>
        templateSupportsChannel(t, "whatsapp_me"),
      );
    },
  });

  const selected = useMemo(
    () => templates.find((t) => t.id === templateId) || templates[0] || null,
    [templates, templateId],
  );

  const digits = useMemo(() => {
    if (!user) return null;
    return normalizeWhatsAppDigits(user.phone_e164 || user.phone || "");
  }, [user]);

  const preview = useMemo(() => {
    if (!selected || !user) return "";
    const name =
      [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
      user.email ||
      "client";
    return interpolateOutreach(selected.whatsapp_body, {
      name,
      cta_url: DEFAULT_CTA_URL,
    });
  }, [selected, user]);

  const handleSend = async () => {
    if (!user || !selected || !digits || !preview.trim()) {
      toast.error("Téléphone ou template manquant");
      return;
    }
    if (!admin?.id) {
      toast.error("Session admin requise");
      return;
    }

    setSending(true);
    try {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await (supabase as any)
        .from("outreach_send_log")
        .select("id", { count: "exact", head: true })
        .eq("actor_admin_id", admin.id)
        .eq("channel", "whatsapp_me")
        .gte("created_at", since);

      if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
        toast.error(`Limite atteinte (${RATE_LIMIT_PER_HOUR}/heure). Réessayez plus tard.`);
        return;
      }

      const opened = openWhatsAppWithDigits(digits, preview);
      if (!opened.ok) {
        toast.error("Impossible d'ouvrir WhatsApp — numéro invalide");
        await (supabase as any).from("outreach_send_log").insert({
          user_id: user.id,
          template_id: selected.id,
          channel: "whatsapp_me",
          status: "failed",
          actor_admin_id: admin.id,
          meta: { reason: opened.reason || "open_failed" },
        });
        return;
      }

      const { error } = await (supabase as any).from("outreach_send_log").insert({
        user_id: user.id,
        template_id: selected.id,
        channel: "whatsapp_me",
        status: "sent",
        actor_admin_id: admin.id,
        meta: { digits_suffix: digits.slice(-4), slug: selected.slug },
      });
      if (error) console.warn("[outreach] log insert", error);
      toast.success("WhatsApp ouvert avec le message utilitaire");
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Envoyer via WhatsApp (wa.me)</DialogTitle>
        </DialogHeader>
        {!user ? null : !digits ? (
          <p className="text-sm text-muted-foreground">
            Aucun téléphone valide sur ce profil. Ajoutez un numéro avant d&apos;envoyer.
          </p>
        ) : isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun template wa.me actif. Créez-en un dans Notifications → Messages utilitaires.
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Template</label>
              <select
                value={selected?.id || ""}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full h-9 text-sm rounded-md border border-input bg-background px-2 mt-1"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} ({t.slug})
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-[10px] text-muted-foreground mb-1">Aperçu</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{preview}</p>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Ouverture manuelle de WhatsApp — aucun envoi Cloud API automatique.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSend}
            disabled={!digits || !selected || sending}
            className="bg-[#25D366] hover:bg-[#1ebe57] text-white"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : "Ouvrir WhatsApp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
