import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Search, Store, UserPlus } from "lucide-react";

export function AdminCreateStoreDialog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<{ id: string; email: string } | null>(null);
  const [storeName, setStoreName] = useState("");
  const [isPlatformOwned, setIsPlatformOwned] = useState(false);

  const handleSearchUser = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setFoundUser(null);

    const { data } = await supabase
      .from("profiles")
      .select("id, email")
      .ilike("email", `%${searchEmail.trim()}%`)
      .limit(1)
      .maybeSingle();

    if (data) {
      setFoundUser(data);
    } else {
      toast({ title: "Aucun utilisateur trouvé", description: `Aucun compte avec l'email "${searchEmail}"`, variant: "destructive" });
    }
    setSearching(false);
  };

  const handleCreate = async () => {
    if (!foundUser || !storeName.trim()) return;
    setSaving(true);

    // Create the store
    const { data: newStore, error: storeError } = await (supabase as any)
      .from("stores")
      .insert({
        name: storeName.trim(),
        owner_id: foundUser.id,
        is_platform_owned: isPlatformOwned,
        status: "active",
      })
      .select("id")
      .single();

    if (storeError) {
      toast({ title: "Erreur", description: storeError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Ensure user has vendor role
    const { data: existingRole } = await (supabase as any)
      .from("user_roles")
      .select("id")
      .eq("user_id", foundUser.id)
      .eq("role", "vendor")
      .maybeSingle();

    if (!existingRole) {
      await (supabase as any)
        .from("user_roles")
        .insert({ user_id: foundUser.id, role: "vendor" });
    }

    toast({
      title: "Boutique créée",
      description: `"${storeName}" assignée à ${foundUser.email}${isPlatformOwned ? " (plateforme)" : ""}`,
    });

    // Reset and close
    setStoreName("");
    setSearchEmail("");
    setFoundUser(null);
    setIsPlatformOwned(false);
    setOpen(false);
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["admin-stores-pricing"] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <UserPlus size={14} />
          Créer une boutique pour un utilisateur
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store size={18} className="text-primary" />
            Créer et assigner une boutique
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Search user by email */}
          <div className="space-y-2">
            <Label className="text-xs">Rechercher un utilisateur par email</Label>
            <div className="flex gap-2">
              <Input
                placeholder="email@exemple.com"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchUser()}
                className="flex-1"
              />
              <Button variant="secondary" size="sm" onClick={handleSearchUser} disabled={searching}>
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </Button>
            </div>
            {foundUser && (
              <div className="bg-muted/50 border border-border rounded-lg p-2 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserPlus size={12} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">{foundUser.email}</p>
                  <p className="text-[10px] text-muted-foreground">ID: {foundUser.id.slice(0, 8)}…</p>
                </div>
              </div>
            )}
          </div>

          {/* Store name */}
          <div className="space-y-2">
            <Label className="text-xs">Nom de la boutique</Label>
            <Input
              placeholder="Ma Boutique"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
          </div>

          {/* Platform owned toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div>
              <p className="text-xs font-medium text-foreground">Boutique plateforme</p>
              <p className="text-[10px] text-muted-foreground">Gérée par un agent de la plateforme</p>
            </div>
            <Switch
              checked={isPlatformOwned}
              onCheckedChange={setIsPlatformOwned}
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleCreate}
            disabled={saving || !foundUser || !storeName.trim()}
            className="w-full"
          >
            {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : <Plus size={14} className="mr-2" />}
            Créer la boutique
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
