import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface FollowStoreButtonProps {
  storeId: string;
  storeName: string;
  size?: "sm" | "default";
  className?: string;
}

export function FollowStoreButton({ storeId, storeName, size = "default", className }: FollowStoreButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  useEffect(() => {
    // Get follower count
    supabase
      .from("store_followers" as any)
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .then(({ count }) => setFollowersCount(count || 0));

    // Check if current user follows
    if (user) {
      supabase
        .from("store_followers" as any)
        .select("id")
        .eq("store_id", storeId)
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => setIsFollowing(!!data));
    }
  }, [storeId, user]);

  const handleToggle = async () => {
    if (!user) {
      toast({ title: "Connexion requise", description: "Connectez-vous pour suivre cette boutique.", variant: "destructive" });
      return;
    }
    setLoading(true);
    if (isFollowing) {
      await supabase
        .from("store_followers" as any)
        .delete()
        .eq("store_id", storeId)
        .eq("user_id", user.id);
      setIsFollowing(false);
      setFollowersCount((c) => Math.max(0, c - 1));
      toast({ title: "Désabonné", description: `Vous ne suivez plus ${storeName}.` });
    } else {
      await supabase
        .from("store_followers" as any)
        .insert({ store_id: storeId, user_id: user.id });
      setIsFollowing(true);
      setFollowersCount((c) => c + 1);
      toast({ title: "Abonné !", description: `Vous suivez maintenant ${storeName}.` });
    }
    queryClient.invalidateQueries({ queryKey: ["store", storeId] });
    setLoading(false);
  };

  return (
    <Button
      variant={isFollowing ? "secondary" : "default"}
      size={size}
      onClick={handleToggle}
      disabled={loading}
      className={`gap-1.5 text-xs ${className || ""}`}
    >
      {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
      {isFollowing ? "Suivi" : "Suivre"}
      {followersCount > 0 && <span className="text-[10px] opacity-70">({followersCount})</span>}
    </Button>
  );
}
