import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Flame, Plus, Trash2, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

interface FlashSale {
  id: string;
  product_id: string;
  flash_price: number;
  original_price: number;
  starts_at: string;
  ends_at: string;
  max_quantity: number | null;
  sold_quantity: number;
  is_active: boolean;
  created_at: string;
  products?: { name_fr: string; price: number } | null;
}

export default function AdminFlashSalesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [flashPrice, setFlashPrice] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxQty, setMaxQty] = useState("");

  const { data: sales, isLoading } = useQuery({
    queryKey: ["admin-flash-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flash_sales" as any)
        .select("*, products(name_fr, price)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as FlashSale[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // Get product price
      const { data: prod } = await supabase
        .from("products")
        .select("price")
        .eq("id", productId)
        .single();
      if (!prod) throw new Error("Produit introuvable");

      const { error } = await supabase.from("flash_sales" as any).insert({
        product_id: productId,
        flash_price: parseFloat(flashPrice),
        original_price: Number(prod.price),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        max_quantity: maxQty ? parseInt(maxQty) : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Vente flash créée" });
      queryClient.invalidateQueries({ queryKey: ["admin-flash-sales"] });
      setOpen(false);
      setProductId("");
      setFlashPrice("");
      setStartsAt("");
      setEndsAt("");
      setMaxQty("");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("flash_sales" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Supprimé" });
      queryClient.invalidateQueries({ queryKey: ["admin-flash-sales"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("flash_sales" as any)
        .update({ is_active: active } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-flash-sales"] }),
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Flame className="text-sale" size={22} />
            Ventes Flash
          </h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus size={16} className="mr-1" /> Nouvelle vente flash</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une vente flash</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground">ID Produit</label>
                  <Input value={productId} onChange={e => setProductId(e.target.value)} placeholder="UUID du produit" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Prix flash ($)</label>
                  <Input type="number" value={flashPrice} onChange={e => setFlashPrice(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Début</label>
                  <Input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Fin</label>
                  <Input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Quantité max (optionnel)</label>
                  <Input type="number" value={maxQty} onChange={e => setMaxQty(e.target.value)} />
                </div>
                <Button className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 size={16} className="animate-spin mr-2" />}
                  Créer
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">Chargement...</div>
        ) : !sales?.length ? (
          <div className="text-center text-muted-foreground py-12">Aucune vente flash</div>
        ) : (
          <div className="space-y-3">
            {sales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-sm">
                <div>
                  <p className="font-medium text-foreground text-sm">{sale.products?.name_fr || sale.product_id}</p>
                  <p className="text-xs text-muted-foreground">
                    {sale.flash_price}$ (au lieu de {sale.original_price}$) — 
                    {new Date(sale.starts_at).toLocaleDateString("fr")} → {new Date(sale.ends_at).toLocaleDateString("fr")}
                    {sale.max_quantity && ` — Max: ${sale.max_quantity}, Vendus: ${sale.sold_quantity}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={sale.is_active ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleMutation.mutate({ id: sale.id, active: !sale.is_active })}
                  >
                    {sale.is_active ? "Actif" : "Inactif"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(sale.id)}>
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
