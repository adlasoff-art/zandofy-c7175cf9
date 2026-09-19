import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CascadingAddressFields,
  type AddressData,
} from "@/components/address/CascadingAddressFields";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin } from "lucide-react";

const EMPTY_ADDRESS: AddressData = {
  country: "",
  province: "",
  province_id: "",
  city: "",
  commune: "",
  quartier: "",
  address: "",
  postal_code: "",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function AddressOnboardingDialog({ open, onOpenChange, onSaved }: Props) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("Domicile");
  const [addr, setAddr] = useState<AddressData>(EMPTY_ADDRESS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("phone, first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.phone) setPhone(data.phone);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user?.id]);

  const onChange = (field: keyof AddressData, value: string) => {
    setAddr((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!addr.city.trim() || !addr.address.trim() || !phone.trim()) {
      toast({
        title: t("checkout.requiredField") || "Champs requis",
        description: t("checkout.fillRequired") || "Téléphone, ville et adresse sont requis.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();

      const { error } = await supabase.from("saved_addresses").insert({
        user_id: user.id,
        label: label.trim() || "Domicile",
        first_name: profile?.first_name || "—",
        last_name: profile?.last_name || "—",
        phone: phone.trim(),
        address: addr.address.trim(),
        city: addr.city.trim(),
        country: addr.country || "CD",
        postal_code: addr.postal_code || null,
        is_default: true,
        ...(addr.quartier ? { quartier: addr.quartier } : {}),
        ...(addr.commune ? { commune: addr.commune } : {}),
        ...(addr.province ? { province: addr.province } : {}),
      } as any);

      if (error) throw error;

      if (phone.trim()) {
        await supabase.from("profiles").update({ phone: phone.trim() }).eq("id", user.id);
      }

      toast({ title: t("addressOnboarding.saved") || "Adresse enregistrée" });
      setAddr(EMPTY_ADDRESS);
      onSaved();
    } catch (err: any) {
      toast({
        title: t("auth.error") || "Erreur",
        description: err?.message || t("auth.genericError"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin size={18} className="text-primary" />
            {t("addressOnboarding.title") || "Ajoutez votre adresse"}
          </DialogTitle>
          <DialogDescription>
            {t("addressOnboarding.desc") ||
              "Pour commander plus vite, enregistrez votre téléphone et votre adresse de livraison."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("addressOnboarding.phone") || "Téléphone"}</Label>
            <Input
              type="tel"
              placeholder="+243 …"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("addressOnboarding.label") || "Libellé"}</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <CascadingAddressFields data={addr} onChange={onChange} />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("addressOnboarding.later") || "Plus tard"}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            {t("addressOnboarding.save") || "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
