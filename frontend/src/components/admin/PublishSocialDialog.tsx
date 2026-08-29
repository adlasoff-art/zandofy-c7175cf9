/**
 * Admin dialog: approve + optional social post, or manual publish for existing products.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Share2, Facebook, Instagram } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  buildSocialCaption,
  type SocialImageMode,
} from "@/lib/social-product-caption";

export type PublishSocialMode = "after_approve" | "manual";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string | null;
  mode: PublishSocialMode;
  /** Called when user confirms. Should publish product if after_approve. */
  onConfirmApprove?: () => Promise<void>;
  onDone?: () => void;
}

export function PublishSocialDialog({
  open,
  onOpenChange,
  productId,
  mode,
  onConfirmApprove,
  onDone,
}: Props) {
  const [imageMode, setImageMode] = useState<SocialImageMode>("primary");
  const [postSocial, setPostSocial] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setImageMode("primary");
    setPostSocial(true);
  }, [open, productId]);

  const { data: platformSettings } = useQuery({
    queryKey: ["social-post-settings"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("social_post_settings")
        .select("platform, is_enabled");
      if (error) throw error;
      return (data || []) as { platform: string; is_enabled: boolean }[];
    },
  });

  const igEnabled = platformSettings?.find((s) => s.platform === "instagram")?.is_enabled === true;

  const { data: product, isLoading } = useQuery({
    queryKey: ["publish-social-preview", productId],
    enabled: !!productId && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("products")
        .select(
          "id, name, name_fr, slug, short_description, price, currency, material, style, origin_country, publish_status, product_images(image_url, position), product_colors(color_name), product_sizes(size_label)",
        )
        .eq("id", productId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: existingJobs = [], refetch: refetchJobs } = useQuery({
    queryKey: ["social-post-jobs", productId],
    enabled: !!productId && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("social_post_jobs")
        .select("id, platform, status, external_post_id, external_permalink, last_error, posted_at, created_at")
        .eq("product_id", productId!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const captionInput = useMemo(() => {
    if (!product) return null;
    return {
      title: product.name_fr || product.name || "Produit Zandofy",
      slug: product.slug,
      productId: product.id,
      shortDescription: product.short_description,
      currency: product.currency,
      price: Number(product.price),
      colors: (product.product_colors || []).map((c: any) => c.color_name).filter(Boolean),
      sizes: (product.product_sizes || []).map((s: any) => s.size_label).filter(Boolean),
      material: product.material,
      style: product.style,
      originCountry: product.origin_country,
    };
  }, [product]);

  const fbCaption = captionInput ? buildSocialCaption("facebook", captionInput) : "";
  const igCaption = captionInput ? buildSocialCaption("instagram", captionInput) : "";

  const alreadyPosted = (existingJobs as any[]).some(
    (j) => j.status === "posted" || j.status === "pending" || j.status === "processing",
  );

  const enqueueAndProcess = async (forceRepost: boolean) => {
    if (!productId) return;
    const { data, error } = await (supabase as any).rpc("enqueue_product_social_posts", {
      p_product_id: productId,
      p_image_mode: imageMode,
      p_force_repost: forceRepost,
    });
    if (error) throw error;

    const jobIds = [data?.facebook_job_id, data?.instagram_job_id].filter(Boolean);
    const { data: proc, error: invErr } = await supabase.functions.invoke("publish-social-product", {
      body: { job_ids: jobIds },
    });
    if (invErr) {
      throw new Error(invErr.message || "Edge function invoke failed — jobs remain pending");
    }
    if (proc?.error) {
      throw new Error(String(proc.error));
    }
    const failed = Array.isArray(proc?.results)
      ? proc.results.filter((r: any) => r && r.ok === false && r.error !== "claim_skipped")
      : [];
    if (failed.length > 0) {
      const detail = failed.map((r: any) => `${r.platform}: ${r.error}`).join(" · ");
      throw new Error(detail || "Some social jobs failed");
    }
    await refetchJobs();
    return data;
  };

  const handleConfirm = async () => {
    if (!productId) return;
    setSubmitting(true);
    try {
      if (mode === "after_approve" && onConfirmApprove) {
        await onConfirmApprove();
      }

      const shouldPost = mode === "manual" || postSocial;
      if (shouldPost) {
        try {
          await enqueueAndProcess(alreadyPosted);
          toast.success(
            igEnabled
              ? "Publié sur les réseaux (Facebook → Instagram)"
              : "Publié sur Facebook (Instagram en pause)",
          );
        } catch (err: any) {
          toast.warning("Produit OK, publication sociale partielle ou en attente", {
            description: err?.message || String(err),
          });
        }
      } else if (mode === "after_approve") {
        toast.success("Produit approuvé et publié");
      }

      onOpenChange(false);
      onDone?.();
    } catch (err: any) {
      toast.error(err?.message || "Échec");
    } finally {
      setSubmitting(false);
    }
  };

  const imageCount = (product?.product_images || []).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 size={18} className="text-primary" />
            {mode === "after_approve" ? "Approuver et partager" : "Publier sur les réseaux"}
          </DialogTitle>
          <DialogDescription>
            {igEnabled
              ? "Facebook d’abord, puis Instagram. Lien produit en 2ᵉ ligne (FB) / dernière ligne (IG)."
              : "Publication Facebook uniquement — Instagram est en pause jusqu’à ce que la Page fonctionne."}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !product ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="animate-spin mr-2" size={16} /> Chargement…
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground truncate">
              {product.name_fr || product.name}
            </p>

            {mode === "after_approve" && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={postSocial}
                  onCheckedChange={(v) => setPostSocial(v === true)}
                />
                {igEnabled
                  ? "Poster aussi sur Facebook et Instagram"
                  : "Poster aussi sur Facebook"}
              </label>
            )}

            {(mode === "manual" || postSocial) && (
              <>
                {!igEnabled && (
                  <p className="text-xs rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200 px-3 py-2">
                    Instagram désactivé dans les réglages. On réactivera après un post Facebook réussi.
                  </p>
                )}
                <div className="space-y-2">
                  <Label>Images</Label>
                  <div className="flex flex-col gap-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="imageMode"
                        checked={imageMode === "primary"}
                        onChange={() => setImageMode("primary")}
                      />
                      Une image (principale)
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="imageMode"
                        checked={imageMode === "all"}
                        onChange={() => setImageMode("all")}
                        disabled={imageCount < 2}
                      />
                      Toutes les images ({Math.min(imageCount, 10)} max)
                    </label>
                  </div>
                </div>

                <Tabs defaultValue="facebook">
                  <TabsList className={`grid w-full ${igEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
                    <TabsTrigger value="facebook" className="gap-1">
                      <Facebook size={12} /> Facebook
                    </TabsTrigger>
                    {igEnabled && (
                      <TabsTrigger value="instagram" className="gap-1">
                        <Instagram size={12} /> Instagram
                      </TabsTrigger>
                    )}
                  </TabsList>
                  <TabsContent value="facebook">
                    <pre className="text-[11px] whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 max-h-48 overflow-y-auto">
                      {fbCaption}
                    </pre>
                  </TabsContent>
                  {igEnabled && (
                    <TabsContent value="instagram">
                      <pre className="text-[11px] whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 max-h-48 overflow-y-auto">
                        {igCaption}
                      </pre>
                    </TabsContent>
                  )}
                </Tabs>

                {existingJobs.length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Historique récent</p>
                    {(existingJobs as any[]).slice(0, 4).map((j) => (
                      <div key={j.id} className="flex justify-between gap-2">
                        <span>
                          {j.platform} · {j.status}
                        </span>
                        {j.external_permalink ? (
                          <a
                            href={j.external_permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            Voir
                          </a>
                        ) : (
                          <span className="truncate max-w-[140px]">{j.last_error || j.external_post_id || ""}</span>
                        )}
                      </div>
                    ))}
                    {alreadyPosted && mode === "manual" && (
                      <p className="text-amber-600 dark:text-amber-400">
                        Un post actif existe déjà — confirmer republiera (force).
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || isLoading || !product}>
            {submitting && <Loader2 className="animate-spin mr-1" size={14} />}
            {mode === "after_approve"
              ? postSocial
                ? "Approuver et poster"
                : "Approuver seulement"
              : alreadyPosted
                ? "Republier"
                : "Publier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
