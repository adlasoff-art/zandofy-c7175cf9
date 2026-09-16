/**
 * ForwarderShipmentsPage — Vague 1 TMS:
 * Geo O/D, weight + pricing profile quote snapshot, search/filter, compact list.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Copy, Link2, Loader2, Plane, Ship, Truck, Search, MessageCircle, Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useForwarderContext } from "@/hooks/use-forwarder-context";
import { GeoFieldsRow, type GeoFieldsValue } from "@/components/address/GeoFieldsRow";
import { getCountryName } from "@/components/vendor/CountryCombobox";
import { ConsigneeCombobox, type Consignee } from "@/components/forwarder/ConsigneeCombobox";
import {
  buildWaMeUrl,
  renderWaTemplate,
  resolveWaTemplates,
  type WaTemplateKey,
} from "@/lib/forwarder-wa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STATUS_OPTIONS = [
  { value: "created", label: "Créée" },
  { value: "booked", label: "Réservée" },
  { value: "in_transit", label: "En transit" },
  { value: "customs", label: "Dédouanement" },
  { value: "arrived", label: "Arrivée" },
  { value: "out_for_delivery", label: "En livraison" },
  { value: "delivered", label: "Livrée" },
  { value: "cancelled", label: "Annulée" },
];

const MODE_OPTIONS = [
  { value: "air", label: "Aérien", icon: Plane },
  { value: "sea", label: "Maritime", icon: Ship },
  { value: "road", label: "Routier", icon: Truck },
  { value: "rail", label: "Ferroviaire", icon: Truck },
  { value: "multimodal", label: "Multimodal", icon: Package },
];

type ShipmentRow = {
  id: string;
  public_token: string;
  awb_bl: string | null;
  mode: string;
  status: string;
  origin: string | null;
  destination: string | null;
  origin_country_code: string | null;
  destination_country_code: string | null;
  weight_kg: number | null;
  quoted_amount: number | null;
  quoted_currency: string | null;
  consignee_name: string | null;
  consignee_phone: string | null;
  eta: string | null;
  created_at: string;
  updated_at: string;
};

type PricingProfile = {
  id: string;
  mode: string;
  country_code: string;
  currency: string;
  is_active: boolean;
  city_id: string | null;
};

type PieceTier = {
  id: string;
  profile_id: string;
  category_id: string | null;
  custom_label: string | null;
  price: number;
};

function geoLabel(country?: string, city?: string): string {
  const parts: string[] = [];
  if (city?.trim()) parts.push(city.trim());
  if (country?.trim()) parts.push(getCountryName(country.trim()) || country.trim());
  return parts.join(", ");
}

const emptyGeo: GeoFieldsValue = { country: "", city: "" };

export default function ForwarderShipmentsPage() {
  const { forwarder } = useForwarderContext();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [originGeo, setOriginGeo] = useState<GeoFieldsValue>(emptyGeo);
  const [destGeo, setDestGeo] = useState<GeoFieldsValue>(emptyGeo);
  const [form, setForm] = useState({
    awb_bl: "",
    mode: "air",
    consignee_id: "" as string,
    consignee_name: "",
    consignee_phone: "",
    eta: "",
    notes: "",
    weight_kg: "",
    quantity: "1",
    category_id: "",
    pricing_profile_id: "",
    save_to_carnet: false,
  });
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [quotePreview, setQuotePreview] = useState<{
    total: number;
    currency: string;
    billing_basis: "per_kg" | "flat" | "per_piece";
    breakdown: unknown;
    error?: string;
  } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ["forwarder-external-shipments", forwarder?.id],
    enabled: !!forwarder?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("external_shipments")
        .select(
          "id, public_token, awb_bl, mode, status, origin, destination, origin_country_code, destination_country_code, weight_kg, quoted_amount, quoted_currency, consignee_name, consignee_phone, eta, created_at, updated_at",
        )
        .eq("forwarder_id", forwarder!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as ShipmentRow[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["forwarder-profiles-for-shipments", forwarder?.id],
    enabled: !!forwarder?.id && showForm,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("forwarder_pricing_profiles")
        .select("id, mode, country_code, currency, is_active, city_id")
        .eq("forwarder_id", forwarder!.id)
        .eq("is_active", true)
        .order("mode")
        .order("country_code");
      if (error) throw error;
      return (data || []) as PricingProfile[];
    },
  });

  const matchedProfiles = useMemo(() => {
    const dest = (destGeo.country || "").toUpperCase();
    return profiles.filter((p) => {
      if (p.mode !== form.mode) return false;
      if (!dest) return true;
      return p.country_code?.toUpperCase() === dest;
    });
  }, [profiles, form.mode, destGeo.country]);

  const selectedProfileId = form.pricing_profile_id || matchedProfiles[0]?.id || "";

  const { data: pieceTiers = [] } = useQuery({
    queryKey: ["piece-tiers-shipment", selectedProfileId],
    enabled: !!selectedProfileId && showForm,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("forwarder_piece_tiers")
        .select("id, profile_id, category_id, custom_label, price")
        .eq("profile_id", selectedProfileId)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as PieceTier[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories-for-shipment-quote"],
    enabled: showForm && pieceTiers.length > 0,
    queryFn: async () => {
      const ids = [...new Set(pieceTiers.map((t) => t.category_id).filter(Boolean))];
      if (ids.length === 0) return [] as { id: string; name_fr: string }[];
      const { data } = await (supabase as any).from("categories").select("id, name_fr").in("id", ids);
      return (data || []) as { id: string; name_fr: string }[];
    },
  });

  // Live quote preview
  useEffect(() => {
    if (!showForm || !selectedProfileId) {
      setQuotePreview(null);
      return;
    }
    const weight = parseFloat(form.weight_kg);
    const qty = Math.max(1, parseFloat(form.quantity) || 1);
    const hasPiece = !!form.category_id && pieceTiers.some((t) => t.category_id === form.category_id);
    if (!hasPiece && (!Number.isFinite(weight) || weight <= 0)) {
      setQuotePreview(null);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setQuoteLoading(true);
      try {
        const items = [
          {
            category_id: form.category_id || undefined,
            quantity: qty,
            cbm: 0,
            weight_kg: Number.isFinite(weight) && weight > 0 ? weight : 0,
          },
        ];
        const raw = await (supabase.rpc as any)("quote_forwarder", {
          p_profile_id: selectedProfileId,
          p_items: items,
          p_total_cbm: null,
        });
        if (cancelled) return;
        if (raw.error) {
          setQuotePreview({ total: 0, currency: "USD", billing_basis: "per_kg", breakdown: {}, error: raw.error.message });
          return;
        }
        const data = raw.data as any;
        if (!data || data.error) {
          setQuotePreview({
            total: 0,
            currency: matchedProfiles.find((p) => p.id === selectedProfileId)?.currency || "USD",
            billing_basis: "per_kg",
            breakdown: data || {},
            error: data?.error || "Devis indisponible",
          });
          return;
        }
        const tier = data?.subpackages?.[0]?.tier_used as string | undefined;
        const billing_basis: "per_kg" | "flat" | "per_piece" =
          tier === "piece" ? "per_piece" : "per_kg";
        const total = Number(data.total) || 0;
        setQuotePreview({
          total,
          currency: data.currency || "USD",
          billing_basis,
          breakdown: data,
          error:
            total <= 0 && (tier === "quote_only" || tier === "none" || !tier)
              ? "Aucun palier tarifaire applicable"
              : undefined,
        });
      } catch (e: any) {
        if (!cancelled) {
          setQuotePreview({
            total: 0,
            currency: "USD",
            billing_basis: "per_kg",
            breakdown: {},
            error: e?.message || "Erreur devis",
          });
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [
    showForm,
    selectedProfileId,
    form.weight_kg,
    form.quantity,
    form.category_id,
    pieceTiers,
    matchedProfiles,
  ]);

  // Keep pricing_profile_id in sync with matched list
  useEffect(() => {
    if (!showForm) return;
    if (form.pricing_profile_id && matchedProfiles.some((p) => p.id === form.pricing_profile_id)) return;
    if (matchedProfiles[0]) {
      setForm((f) => ({ ...f, pricing_profile_id: matchedProfiles[0].id }));
    } else {
      setForm((f) => ({ ...f, pricing_profile_id: "" }));
    }
  }, [matchedProfiles, showForm, form.pricing_profile_id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shipments.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        s.awb_bl,
        s.origin,
        s.destination,
        s.consignee_name,
        s.consignee_phone,
        s.origin_country_code,
        s.destination_country_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [shipments, search, statusFilter]);

  const resetForm = () => {
    setForm({
      awb_bl: "",
      mode: "air",
      consignee_id: "",
      consignee_name: "",
      consignee_phone: "",
      eta: "",
      notes: "",
      weight_kg: "",
      quantity: "1",
      category_id: "",
      pricing_profile_id: "",
      save_to_carnet: false,
    });
    setOriginGeo(emptyGeo);
    setDestGeo(emptyGeo);
    setQuotePreview(null);
    setPendingPhotos([]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!forwarder?.id) throw new Error("Forwarder manquant");
      if (!originGeo.country?.trim() || !destGeo.country?.trim()) {
        throw new Error("Pays d'origine et de destination obligatoires");
      }
      if (!selectedProfileId) {
        throw new Error("Aucun profil tarifaire pour ce mode / pays de destination");
      }
      if (!quotePreview || quotePreview.error || quotePreview.total <= 0) {
        throw new Error(quotePreview?.error || "Renseignez le poids (ou une catégorie) pour obtenir un tarif");
      }

      const originLabel = geoLabel(originGeo.country, originGeo.city);
      const destLabel = geoLabel(destGeo.country, destGeo.city);
      const weight = parseFloat(form.weight_kg);
      const qty = Math.max(1, parseFloat(form.quantity) || 1);

      let consigneeId = form.consignee_id || null;
      if (
        form.save_to_carnet &&
        !consigneeId &&
        form.consignee_name.trim()
      ) {
        const { data: createdC, error: cErr } = await (supabase as any)
          .from("forwarder_consignees")
          .insert({
            forwarder_id: forwarder.id,
            name: form.consignee_name.trim(),
            phone: form.consignee_phone.trim() || null,
          })
          .select("id")
          .single();
        if (cErr) throw cErr;
        consigneeId = createdC.id;
      }

      const { data: row, error } = await (supabase as any)
        .from("external_shipments")
        .insert({
          forwarder_id: forwarder.id,
          awb_bl: form.awb_bl.trim() || null,
          mode: form.mode,
          origin: originLabel || null,
          destination: destLabel || null,
          origin_country_code: originGeo.country!.toUpperCase(),
          origin_city: originGeo.city?.trim() || null,
          destination_country_code: destGeo.country!.toUpperCase(),
          destination_city: destGeo.city?.trim() || null,
          consignee_id: consigneeId,
          consignee_name: form.consignee_name.trim() || null,
          consignee_phone: form.consignee_phone.trim() || null,
          eta: form.eta || null,
          notes: form.notes.trim() || null,
          weight_kg: Number.isFinite(weight) && weight > 0 ? weight : null,
          quantity: qty,
          category_id: form.category_id || null,
          pricing_profile_id: selectedProfileId,
          billing_basis: quotePreview.billing_basis,
          quoted_amount: quotePreview.total,
          quoted_currency: quotePreview.currency,
          quote_breakdown: quotePreview.breakdown || {},
          status: "created",
          events: [
            {
              at: new Date().toISOString(),
              status: "created",
              label: "Expédition créée",
            },
          ],
        })
        .select("id, public_token")
        .single();
      if (error) throw error;

      const photoPaths: string[] = [];
      for (const file of pendingPhotos.slice(0, 5)) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${row.public_token}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("external-shipment-photos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          console.warn("[shipments] photo upload failed", upErr);
          continue;
        }
        photoPaths.push(path);
      }
      if (photoPaths.length > 0) {
        await (supabase as any)
          .from("external_shipments")
          .update({ photo_paths: photoPaths })
          .eq("id", row.id);
      }
    },
    onSuccess: () => {
      toast.success("Expédition créée");
      setShowForm(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["forwarder-external-shipments", forwarder?.id] });
      qc.invalidateQueries({ queryKey: ["forwarder-consignees", forwarder?.id] });
    },
    onError: (e: any) => toast.error(e.message || "Échec création"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data: current } = await (supabase as any)
        .from("external_shipments")
        .select("events")
        .eq("id", id)
        .maybeSingle();
      const events = Array.isArray(current?.events) ? [...current.events] : [];
      events.push({
        at: new Date().toISOString(),
        status,
        label: STATUS_OPTIONS.find((o) => o.value === status)?.label || status,
      });
      const { error } = await (supabase as any)
        .from("external_shipments")
        .update({ status, events })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["forwarder-external-shipments", forwarder?.id] });
    },
    onError: (e: any) => toast.error(e.message || "Échec mise à jour"),
  });

  const publicBase = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/t`;
  }, []);

  const copyLink = async (token: string) => {
    const url = `${publicBase}/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien public copié");
    } catch {
      toast.error("Impossible de copier le lien");
    }
  };

  const openWhatsApp = (s: ShipmentRow, key: WaTemplateKey) => {
    if (!s.consignee_phone) {
      toast.error("Aucun téléphone destinataire");
      return;
    }
    const templates = resolveWaTemplates(forwarder?.wa_templates as Record<string, string> | undefined);
    const statusLabel = STATUS_OPTIONS.find((o) => o.value === s.status)?.label || s.status;
    const text = renderWaTemplate(templates[key], {
      company: forwarder?.name || "Transitaire",
      awb: s.awb_bl || "N/A",
      status: statusLabel,
      tracking_url: `${publicBase}/${s.public_token}`,
      weight: s.weight_kg != null ? `${s.weight_kg} kg` : "",
      amount:
        s.quoted_amount != null
          ? `${Number(s.quoted_amount).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${s.quoted_currency || ""}`
          : "",
    });
    const url = buildWaMeUrl(s.consignee_phone, text);
    if (!url) {
      toast.error("Numéro de téléphone invalide");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ background: "var(--forwarder-gradient)" }}
          >
            <Package size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Expéditions externes</h1>
            <p className="text-xs text-muted-foreground">
              Suivi hors marketplace — partagez un lien public `/t/:token` avec vos clients.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)} className="gap-1.5">
          <Plus size={14} /> Nouvelle expédition
        </Button>
      </header>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">AWB / BL</Label>
              <Input
                placeholder="Référence"
                value={form.awb_bl}
                onChange={(e) => setForm((f) => ({ ...f, awb_bl: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mode</Label>
              <Select value={form.mode} onValueChange={(v) => setForm((f) => ({ ...f, mode: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  {MODE_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Origine *</Label>
            <GeoFieldsRow
              value={originGeo}
              onChange={(patch) => setOriginGeo((g) => ({ ...g, ...patch }))}
              levels={["country", "city"]}
              required={["country"]}
              labels={{ country: "Pays d'origine", city: "Ville d'origine" }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Destination *</Label>
            <GeoFieldsRow
              value={destGeo}
              onChange={(patch) => setDestGeo((g) => ({ ...g, ...patch }))}
              levels={["country", "city"]}
              required={["country"]}
              labels={{ country: "Pays de destination", city: "Ville de destination" }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Destinataire (carnet)</Label>
              {forwarder?.id && (
                <ConsigneeCombobox
                  forwarderId={forwarder.id}
                  valueId={form.consignee_id || null}
                  onSelect={(c: Consignee | null) => {
                    if (!c) {
                      setForm((f) => ({ ...f, consignee_id: "" }));
                      return;
                    }
                    setForm((f) => ({
                      ...f,
                      consignee_id: c.id,
                      consignee_name: c.name,
                      consignee_phone: c.phone || "",
                    }));
                  }}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nom destinataire</Label>
              <Input
                placeholder="Nom"
                value={form.consignee_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, consignee_name: e.target.value, consignee_id: "" }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Téléphone destinataire</Label>
              <Input
                placeholder="+243…"
                value={form.consignee_phone}
                onChange={(e) => setForm((f) => ({ ...f, consignee_phone: e.target.value }))}
              />
            </div>
            {!form.consignee_id && form.consignee_name.trim() && (
              <label className="sm:col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.save_to_carnet}
                  onChange={(e) => setForm((f) => ({ ...f, save_to_carnet: e.target.checked }))}
                />
                Enregistrer dans le carnet
              </label>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">ETA</Label>
              <Input type="date" value={form.eta} onChange={(e) => setForm((f) => ({ ...f, eta: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Profil tarifaire</Label>
              <Select
                value={selectedProfileId || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, pricing_profile_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={matchedProfiles.length ? "Choisir" : "Aucun profil"} />
                </SelectTrigger>
                <SelectContent>
                  {matchedProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.mode.toUpperCase()} · {p.country_code} · {p.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {matchedProfiles.length === 0 && (
                <p className="text-[11px] text-amber-600">
                  Créez un profil Tarif pour ce mode et le pays de destination.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Poids (kg) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.weight_kg}
                onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantité</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            {pieceTiers.length > 0 && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Catégorie (tarif à la pièce)</Label>
                <Select
                  value={form.category_id || "__none__"}
                  onValueChange={(v) => setForm((f) => ({ ...f, category_id: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune (poids / forfait)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucune (poids / forfait)</SelectItem>
                    {pieceTiers
                      .filter((t) => t.category_id)
                      .map((t) => {
                        const name =
                          categories.find((c) => c.id === t.category_id)?.name_fr ||
                          t.custom_label ||
                          t.category_id;
                        return (
                          <SelectItem key={t.id} value={t.category_id!}>
                            {name} — {t.price}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Camera size={12} /> Photos du colis
            </Label>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []).slice(0, 5);
                setPendingPhotos(files);
              }}
            />
            {pendingPhotos.length > 0 && (
              <p className="text-[11px] text-muted-foreground">{pendingPhotos.length} photo(s) sélectionnée(s)</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes internes</Label>
            <Textarea
              placeholder="Notes visibles uniquement par votre équipe"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">Tarif estimé (snapshot à la création)</span>
            {quoteLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : quotePreview?.error ? (
              <span className="text-xs text-amber-600">{quotePreview.error}</span>
            ) : quotePreview ? (
              <span className="font-semibold text-foreground">
                {quotePreview.total.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}{" "}
                {quotePreview.currency}
                <span className="ml-1 text-[10px] font-normal text-muted-foreground uppercase">
                  {quotePreview.billing_basis}
                </span>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              disabled={
                createMutation.isPending ||
                !originGeo.country ||
                !destGeo.country ||
                !selectedProfileId ||
                !quotePreview ||
                !!quotePreview.error ||
                quotePreview.total <= 0
              }
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Créer"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-9"
            placeholder="Rechercher AWB, destinataire, pays…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px] h-9">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          {shipments.length === 0
            ? "Aucune expédition externe pour le moment."
            : "Aucun résultat pour ce filtre."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="bg-card border border-border rounded-md px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 justify-between"
            >
              <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                <span className="font-semibold text-foreground">{s.awb_bl || "Sans AWB"}</span>
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {MODE_OPTIONS.find((m) => m.value === s.mode)?.label || s.mode}
                </span>
                <span className="text-xs text-muted-foreground">
                  {(s.origin_country_code || s.origin || "?") + " → " + (s.destination_country_code || s.destination || "?")}
                </span>
                {s.weight_kg != null && (
                  <span className="text-xs text-muted-foreground">{Number(s.weight_kg)} kg</span>
                )}
                {s.quoted_amount != null && (
                  <span className="text-xs font-medium text-foreground">
                    {Number(s.quoted_amount).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}{" "}
                    {s.quoted_currency || ""}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Link2 size={10} /> /t/{s.public_token.slice(0, 8)}…
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <Select
                  value={s.status}
                  onValueChange={(status) => updateStatusMutation.mutate({ id: s.id, status })}
                >
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="gap-1 h-8" onClick={() => copyLink(s.public_token)}>
                  <Copy size={12} /> Lien
                </Button>
                {s.consignee_phone && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1 h-8 text-emerald-700 border-emerald-200">
                        <MessageCircle size={12} /> WA
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openWhatsApp(s, "arrived")}>Arrivée</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openWhatsApp(s, "reminder")}>Rappel</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openWhatsApp(s, "urgent")}>Urgent</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
