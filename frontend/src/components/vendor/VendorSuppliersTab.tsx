import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Truck, Globe, Mail, Phone, Clock, User, ImageIcon } from "lucide-react";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import { Button } from "@/components/ui/button";
import { MediaUploader } from "@/components/vendor/MediaUploader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Supplier {
  id: string;
  agent_name: string;
  platform_name: string;
  platform_id: string | null;
  store_url: string | null;
  direct_contact: string | null;
  email: string;
  seniority: string | null;
  average_processing_time: string | null;
  product_image_url: string | null;
  created_at: string;
}

interface SupplierPlatform {
  id: string;
  name: string;
  logo_url: string | null;
}

interface MediaItem {
  id?: string;
  url: string;
  type: "image" | "video";
  position: number;
}

const EMPTY_FORM = {
  agent_name: "",
  platform_name: "",
  platform_id: "",
  store_url: "",
  direct_contact: "",
  email: "",
  seniority: "",
  average_processing_time: "",
  product_image_url: "",
};

type SupplierForm = typeof EMPTY_FORM;

export function VendorSuppliersTab({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [platforms, setPlatforms] = useState<SupplierPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(EMPTY_FORM);
  const [productImage, setProductImage] = useState<MediaItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [supplierPage, setSupplierPage] = useState(1);

  // Load platforms
  useEffect(() => {
    (supabase as any)
      .from("supplier_platforms")
      .select("id, name, logo_url")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }: any) => {
        if (data) setPlatforms(data);
      });
  }, []);

  const loadSuppliers = useCallback(async () => {
    if (!user) return;
    setLoading(prev => suppliers.length === 0 ? true : prev);
    const { data } = await (supabase as any)
      .from("suppliers")
      .select("id, agent_name, platform_name, platform_id, store_url, direct_contact, email, seniority, average_processing_time, product_image_url, created_at")
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false });
    setSuppliers(data || []);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    loadSuppliers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPlatformName = (s: Supplier): string => {
    if (s.platform_id) {
      const p = platforms.find(pl => pl.id === s.platform_id);
      if (p) return p.name;
    }
    return s.platform_name || "";
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setProductImage([]);
    setModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      agent_name: s.agent_name,
      platform_name: s.platform_name,
      platform_id: s.platform_id || "",
      store_url: s.store_url || "",
      direct_contact: s.direct_contact || "",
      email: s.email,
      seniority: s.seniority || "",
      average_processing_time: s.average_processing_time || "",
      product_image_url: s.product_image_url || "",
    });
    setProductImage(
      s.product_image_url
        ? [{ url: s.product_image_url, type: "image" as const, position: 0 }]
        : []
    );
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.agent_name.trim()) {
      toast.error("Le nom de l'agent est obligatoire");
      return;
    }
    if (!user) return;
    setSaving(true);

    const selectedPlatform = platforms.find(p => p.id === form.platform_id);

    const payload: any = {
      agent_name: form.agent_name.trim(),
      platform_name: selectedPlatform?.name || form.platform_name.trim(),
      platform_id: form.platform_id || null,
      store_url: form.store_url.trim() || null,
      direct_contact: form.direct_contact.trim() || null,
      email: form.email.trim(),
      seniority: form.seniority.trim() || null,
      average_processing_time: form.average_processing_time.trim() || null,
      product_image_url: productImage.length > 0 ? productImage[0].url : null,
    };

    if (editing) {
      const { error } = await (supabase as any)
        .from("suppliers")
        .update(payload)
        .eq("id", editing.id);
      if (error) {
        toast.error("Erreur : " + error.message);
      } else {
        toast.success("Fournisseur mis à jour");
      }
    } else {
      const { error } = await (supabase as any)
        .from("suppliers")
        .insert({ ...payload, vendor_id: user.id });
      if (error) {
        toast.error("Erreur : " + error.message);
      } else {
        toast.success("Fournisseur ajouté");
      }
    }

    setSaving(false);
    setModalOpen(false);
    loadSuppliers();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer le fournisseur "${name}" ? Les produits liés ne seront pas supprimés.`)) return;
    const { error } = await (supabase as any).from("suppliers").delete().eq("id", id);
    if (error) {
      toast.error("Erreur : " + error.message);
    } else {
      toast.success("Fournisseur supprimé");
      loadSuppliers();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Truck size={18} className="text-primary" />
          Mes Fournisseurs
        </h2>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus size={14} />
          Ajouter
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Truck size={40} className="mx-auto text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">Aucun fournisseur enregistré.</p>
          <p className="text-xs text-muted-foreground">Ajoutez vos sources d'approvisionnement pour les lier à vos produits.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {(() => {
            const suppPageSize = 25;
            const safeSuppPage = Math.max(1, Math.min(supplierPage, Math.ceil(suppliers.length / suppPageSize)));
            const paginatedSuppliers = suppliers.slice((safeSuppPage - 1) * suppPageSize, safeSuppPage * suppPageSize);
            return paginatedSuppliers.map((s) => (
            <div key={s.id} className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                {s.product_image_url ? (
                  <img src={s.product_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User size={18} className="text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-semibold text-foreground">{s.agent_name}</p>
                {getPlatformName(s) && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe size={11} /> {getPlatformName(s)}
                  </p>
                )}
                {s.email && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail size={11} /> {s.email}
                  </p>
                )}
                {s.direct_contact && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone size={11} /> {s.direct_contact}
                  </p>
                )}
                {s.average_processing_time && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock size={11} /> {s.average_processing_time}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Modifier">
                  <Pencil size={14} className="text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(s.id, s.agent_name)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors" title="Supprimer">
                  <Trash2 size={14} className="text-destructive" />
                </button>
              </div>
            </div>
          ))
          })()}
          <DataTablePagination
            totalItems={suppliers.length}
            currentPage={supplierPage}
            pageSize={25}
            onPageChange={setSupplierPage}
            onPageSizeChange={() => {}}
            pageSizeOptions={[25]}
          />
        </div>
      )}

      {/* Modal Add/Edit */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le fournisseur" : "Ajouter un fournisseur"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <FormField label="Nom de l'agent / contact *" value={form.agent_name} onChange={(v) => setForm({ ...form, agent_name: v })} />

            {/* Platform combobox */}
            <div>
              <label className="text-xs text-muted-foreground">Plateforme</label>
              <select
                className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md focus:ring-1 focus:ring-primary outline-none"
                value={form.platform_id}
                onChange={(e) => setForm({ ...form, platform_id: e.target.value })}
              >
                <option value="">— Sélectionner une plateforme —</option>
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <FormField label="URL de la boutique" value={form.store_url} onChange={(v) => setForm({ ...form, store_url: v })} type="url" />
            <FormField label="Contact direct (téléphone/WeChat)" value={form.direct_contact} onChange={(v) => setForm({ ...form, direct_contact: v })} />
            <FormField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
            <FormField label="Ancienneté (ex: 3 ans, depuis 2020)" value={form.seniority} onChange={(v) => setForm({ ...form, seniority: v })} />
            <FormField label="Délai moyen de traitement (ex: 3-5 jours / 100 pcs)" value={form.average_processing_time} onChange={(v) => setForm({ ...form, average_processing_time: v })} />

            {/* Product image upload */}
            <MediaUploader
              label="📷 Image du produit fournisseur"
              items={productImage}
              onChange={setProductImage}
              multiple={false}
              storeId={storeId}
              acceptVideo={false}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                {editing ? "Mettre à jour" : "Ajouter"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md focus:ring-1 focus:ring-primary outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
