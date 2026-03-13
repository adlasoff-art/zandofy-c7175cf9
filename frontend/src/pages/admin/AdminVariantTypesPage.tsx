import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Save, X, Layers, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface VariantType {
  id: string;
  name: string;
  unit: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  options: VariantOption[];
}

interface VariantOption {
  id: string;
  variant_type_id: string;
  label: string;
  sort_order: number;
}

export default function AdminVariantTypesPage() {
  const queryClient = useQueryClient();
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [typeForm, setTypeForm] = useState({ name: "", unit: "", icon: "ruler" });
  const [creatingType, setCreatingType] = useState(false);
  const [newOption, setNewOption] = useState("");

  const { data: variantTypes = [], isLoading } = useQuery({
    queryKey: ["admin-variant-types"],
    queryFn: async () => {
      const { data: types } = await (supabase as any)
        .from("variant_types")
        .select("*")
        .order("sort_order");

      if (!types) return [];

      const { data: options } = await (supabase as any)
        .from("variant_type_options")
        .select("*")
        .order("sort_order");

      const optionsMap = new Map<string, VariantOption[]>();
      (options || []).forEach((o: any) => {
        const arr = optionsMap.get(o.variant_type_id) || [];
        arr.push(o);
        optionsMap.set(o.variant_type_id, arr);
      });

      return types.map((t: any) => ({
        ...t,
        options: optionsMap.get(t.id) || [],
      })) as VariantType[];
    },
  });

  const createType = useMutation({
    mutationFn: async (form: { name: string; unit: string; icon: string }) => {
      const maxOrder = variantTypes.length > 0 ? Math.max(...variantTypes.map(t => t.sort_order)) + 1 : 0;
      const { error } = await (supabase as any).from("variant_types").insert({
        name: form.name,
        unit: form.unit,
        icon: form.icon,
        sort_order: maxOrder,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-variant-types"] });
      toast.success("Type de variation créé");
      setCreatingType(false);
      setTypeForm({ name: "", unit: "", icon: "ruler" });
    },
    onError: () => toast.error("Erreur lors de la création"),
  });

  const updateType = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; unit?: string; icon?: string; is_active?: boolean }) => {
      const { error } = await (supabase as any).from("variant_types").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-variant-types"] });
      toast.success("Type mis à jour");
      setEditingType(null);
    },
    onError: () => toast.error("Erreur"),
  });

  const deleteType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("variant_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-variant-types"] });
      toast.success("Type supprimé");
    },
    onError: () => toast.error("Impossible de supprimer (peut-être utilisé par des produits)"),
  });

  const addOption = useMutation({
    mutationFn: async ({ typeId, label }: { typeId: string; label: string }) => {
      const type = variantTypes.find(t => t.id === typeId);
      const maxOrder = type && type.options.length > 0 ? Math.max(...type.options.map(o => o.sort_order)) + 1 : 0;
      const { error } = await (supabase as any).from("variant_type_options").insert({
        variant_type_id: typeId,
        label,
        sort_order: maxOrder,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-variant-types"] });
      setNewOption("");
      toast.success("Option ajoutée");
    },
    onError: () => toast.error("Erreur"),
  });

  const deleteOption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("variant_type_options").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-variant-types"] });
      toast.success("Option supprimée");
    },
    onError: () => toast.error("Erreur"),
  });

  return (
    <AdminLayout title="Types de variations">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Layers size={20} className="text-primary" />
            Types de variations
          </h1>
          <button
            onClick={() => { setCreatingType(true); setTypeForm({ name: "", unit: "", icon: "ruler" }); }}
            className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-1"
          >
            <Plus size={12} /> Nouveau type
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Définissez les types de variations disponibles pour les vendeurs (pointure, volume, taille d'écran, capacité, etc.) et leurs options.
        </p>

        {/* Create form */}
        {creatingType && (
          <div className="bg-card border border-primary/30 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-bold text-foreground">Nouveau type de variation</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Nom *</label>
                <input
                  type="text"
                  placeholder="ex: Pointure, Volume…"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Unité</label>
                <input
                  type="text"
                  placeholder='ex: ml, kg, ", Go…'
                  value={typeForm.unit}
                  onChange={(e) => setTypeForm({ ...typeForm, unit: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Icône</label>
                <input
                  type="text"
                  placeholder="ex: ruler, droplets…"
                  value={typeForm.icon}
                  onChange={(e) => setTypeForm({ ...typeForm, icon: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => typeForm.name.trim() && createType.mutate(typeForm)}
                disabled={!typeForm.name.trim() || createType.isPending}
                className="px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
              >
                {createType.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Créer
              </button>
              <button
                onClick={() => setCreatingType(false)}
                className="px-4 py-2 text-xs font-medium bg-muted text-foreground rounded-md"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : variantTypes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Layers size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun type de variation défini.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {variantTypes.map((vt) => {
              const isExpanded = expandedType === vt.id;
              const isEditing = editingType === vt.id;

              return (
                <div key={vt.id} className="bg-card border border-border rounded-lg overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-3 p-4">
                    <button
                      onClick={() => setExpandedType(isExpanded ? null : vt.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={typeForm.name}
                            onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                            className="px-2 py-1 text-sm bg-card border border-border rounded-md w-32"
                          />
                          <input
                            type="text"
                            value={typeForm.unit}
                            onChange={(e) => setTypeForm({ ...typeForm, unit: e.target.value })}
                            placeholder="Unité"
                            className="px-2 py-1 text-sm bg-card border border-border rounded-md w-20"
                          />
                          <button
                            onClick={() => updateType.mutate({ id: vt.id, name: typeForm.name, unit: typeForm.unit })}
                            className="p-1 text-primary hover:text-primary/80"
                          >
                            <Save size={14} />
                          </button>
                          <button onClick={() => setEditingType(null)} className="p-1 text-muted-foreground">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{vt.name}</span>
                          {vt.unit && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {vt.unit}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            ({vt.options.length} options)
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={vt.is_active}
                        onCheckedChange={(v) => updateType.mutate({ id: vt.id, is_active: v })}
                      />
                      <button
                        onClick={() => {
                          setEditingType(vt.id);
                          setTypeForm({ name: vt.name, unit: vt.unit, icon: vt.icon });
                        }}
                        className="p-1.5 text-muted-foreground hover:text-primary"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Supprimer le type "${vt.name}" et toutes ses options ?`)) {
                            deleteType.mutate(vt.id);
                          }
                        }}
                        className="p-1.5 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Options panel */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/30 p-4 space-y-2">
                      {vt.options.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">Aucune option. Ajoutez-en ci-dessous.</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {vt.options.map((opt) => (
                          <span
                            key={opt.id}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-card border border-border"
                          >
                            {opt.label}
                            <button
                              onClick={() => deleteOption.mutate(opt.id)}
                              className="text-muted-foreground hover:text-destructive ml-1"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                      {/* Add option */}
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          placeholder={`Nouvelle option (ex: ${vt.unit ? "500" + vt.unit : "valeur"})`}
                          value={expandedType === vt.id ? newOption : ""}
                          onChange={(e) => setNewOption(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newOption.trim()) {
                              e.preventDefault();
                              addOption.mutate({ typeId: vt.id, label: newOption.trim() });
                            }
                          }}
                          className="flex-1 px-3 py-1.5 text-xs bg-card border border-border rounded-md"
                        />
                        <button
                          onClick={() => newOption.trim() && addOption.mutate({ typeId: vt.id, label: newOption.trim() })}
                          disabled={!newOption.trim() || addOption.isPending}
                          className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                        >
                          <Plus size={12} /> Ajouter
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
