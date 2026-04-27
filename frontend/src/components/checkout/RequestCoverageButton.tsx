/**
 * RequestCoverageButton — Permet au client de signaler une zone non couverte
 * pour qu'un opérateur puisse l'ajouter (anti-spam 24h côté EF).
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, MailPlus } from "lucide-react";

export function RequestCoverageButton({
  countryCode,
  city,
  commune,
  quartier,
}: {
  countryCode: string | null | undefined;
  city: string | null | undefined;
  commune?: string | null;
  quartier?: string | null;
}) {
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!city || !countryCode) {
      toast.error("Adresse incomplète");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-delivery-coverage", {
        body: {
          country_code: countryCode,
          city,
          commune: commune || null,
          quartier: quartier || null,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Demande envoyée — nous vous notifierons dès qu'un livreur dessert votre zone.");
    } catch (e: any) {
      toast.error(e.message || "Impossible d'envoyer la demande");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={submit} disabled={loading} className="gap-1">
      {loading ? <Loader2 size={12} className="animate-spin" /> : <MailPlus size={12} />}
      Demander une couverture
    </Button>
  );
}