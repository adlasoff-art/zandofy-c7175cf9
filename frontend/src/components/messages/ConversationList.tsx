import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search, MessageCircle, Star, Filter, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ConversationItem {
  id: string;
  store_id: string;
  product_id: string | null;
  updated_at: string;
  store_name: string;
  store_logo: string | null;
  product_name: string | null;
  last_message: string | null;
  unread_count: number;
  is_starred: boolean;
  is_store_owner: boolean;
  other_party_name: string;
  other_party_avatar: string | null;
  store_is_online: boolean;
}

type FilterType = "all" | "unread" | "starred";

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (conv: ConversationItem) => void;
}

export function ConversationList({ selectedId, onSelect }: ConversationListProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    if (!user) return;
    loadConversations();
  }, [user]);

  async function loadConversations() {
    if (!user) return;
    setLoading(true);

    // Get conversations where user is participant OR store owner
    const [userConvs, storeConvs] = await Promise.all([
      supabase
        .from("conversations")
        .select("id, store_id, product_id, updated_at, is_starred, user_id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      // Get conversations for stores I own
      supabase
        .from("stores")
        .select("id")
        .eq("owner_id", user.id),
    ]);

    let allConvIds: string[] = [];
    const userConvList = userConvs.data || [];
    
    // Get store-owner conversations
    let storeOwnerConvs: any[] = [];
    if (storeConvs.data && storeConvs.data.length > 0) {
      const storeIds = storeConvs.data.map(s => s.id);
      const { data: ownerConvs } = await supabase
        .from("conversations")
        .select("id, store_id, product_id, updated_at, is_starred, user_id")
        .in("store_id", storeIds)
        .order("updated_at", { ascending: false });
      storeOwnerConvs = ownerConvs || [];
    }

    // Merge and deduplicate
    const convMap = new Map<string, any>();
    userConvList.forEach(c => convMap.set(c.id, { ...c, is_store_owner: false }));
    storeOwnerConvs.forEach(c => {
      if (!convMap.has(c.id)) {
        convMap.set(c.id, { ...c, is_store_owner: true });
      }
    });

    const allConvs = Array.from(convMap.values())
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    if (allConvs.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Fetch store info
    const storeIds = [...new Set(allConvs.map(c => c.store_id))];
    const productIds = allConvs.map(c => c.product_id).filter(Boolean) as string[];
    const otherUserIds = allConvs
      .filter(c => c.is_store_owner)
      .map(c => c.user_id)
      .filter(Boolean) as string[];

    const [storesRes, productsRes, profilesRes] = await Promise.all([
      supabase.from("stores").select("id, name, logo_url, is_online").in("id", storeIds),
      productIds.length > 0
        ? supabase.from("products").select("id, name_fr").in("id", productIds)
        : Promise.resolve({ data: [] }),
      otherUserIds.length > 0
        ? supabase.from("profiles").select("id, first_name, last_name, avatar_url").in("id", otherUserIds)
        : Promise.resolve({ data: [] }),
    ]);

    const storeMap = new Map((storesRes.data || []).map(s => [s.id, s]));
    const productMap = new Map((productsRes.data || []).map(p => [p.id, p]));
    const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]));

    // Batch: get last message + unread count per conversation
    const items: ConversationItem[] = [];
    for (const conv of allConvs) {
      const [lastMsgRes, unreadRes] = await Promise.all([
        supabase
          .from("messages")
          .select("content")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .eq("is_read", false)
          .neq("sender_id", user.id),
      ]);

      const store = storeMap.get(conv.store_id);
      const product = conv.product_id ? productMap.get(conv.product_id) : null;
      
      let otherPartyName = store?.name || "Boutique";
      let otherPartyAvatar = store?.logo_url || null;

      if (conv.is_store_owner) {
        const profile = profileMap.get(conv.user_id);
        otherPartyName = profile
          ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Client"
          : "Client";
        otherPartyAvatar = profile?.avatar_url || null;
      }

      items.push({
        id: conv.id,
        store_id: conv.store_id,
        product_id: conv.product_id,
        updated_at: conv.updated_at,
        store_name: store?.name || "Boutique",
        store_logo: store?.logo_url || null,
        product_name: product?.name_fr || null,
        last_message: lastMsgRes.data?.content || null,
        unread_count: unreadRes.count || 0,
        is_starred: conv.is_starred ?? false,
        is_store_owner: conv.is_store_owner,
        other_party_name: otherPartyName,
        other_party_avatar: otherPartyAvatar,
      });
    }

    setConversations(items);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === "unread") list = list.filter(c => c.unread_count > 0);
    if (filter === "starred") list = list.filter(c => c.is_starred);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.other_party_name.toLowerCase().includes(q) ||
        c.product_name?.toLowerCase().includes(q) ||
        c.last_message?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [conversations, filter, search]);

  const toggleStar = async (e: React.MouseEvent, conv: ConversationItem) => {
    e.stopPropagation();
    const newVal = !conv.is_starred;
    setConversations(prev =>
      prev.map(c => c.id === conv.id ? { ...c, is_starred: newVal } : c)
    );
    await supabase
      .from("conversations")
      .update({ is_starred: newVal } as any)
      .eq("id", conv.id);
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "unread", label: "Non lus" },
    { key: "starred", label: "Favoris" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une conversation..."
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 px-3 py-2 border-b border-border">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors",
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageCircle size={36} className="text-muted-foreground/20 mb-2" />
            <p className="text-sm text-muted-foreground">
              {filter === "unread" ? "Aucun message non lu" :
               filter === "starred" ? "Aucun favori" :
               search ? "Aucun résultat" : "Aucune conversation"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(conv => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50",
                  selectedId === conv.id && "bg-muted",
                  conv.unread_count > 0 && "bg-primary/5"
                )}
              >
                {/* Avatar */}
                {conv.other_party_avatar ? (
                  <img
                    src={conv.other_party_avatar}
                    alt={conv.other_party_name}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <MessageCircle size={16} className="text-muted-foreground" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={cn(
                      "text-sm truncate",
                      conv.unread_count > 0 ? "font-bold text-foreground" : "font-medium text-foreground"
                    )}>
                      {conv.other_party_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(conv.updated_at).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  </div>
                  {conv.product_name && (
                    <p className="text-[11px] text-primary truncate">{conv.product_name}</p>
                  )}
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <p className={cn(
                      "text-xs truncate",
                      conv.unread_count > 0 ? "font-semibold text-foreground" : "text-muted-foreground"
                    )}>
                      {conv.last_message
                        ? conv.last_message.startsWith("[📷") ? "📷 Photo" :
                          conv.last_message.startsWith("[📄") ? "📄 Document" :
                          conv.last_message
                        : "Nouvelle conversation"}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      {conv.unread_count > 0 && (
                        <span className="w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                          {conv.unread_count}
                        </span>
                      )}
                      <button
                        onClick={(e) => toggleStar(e, conv)}
                        className="p-0.5 hover:scale-110 transition-transform"
                      >
                        <Star
                          size={14}
                          className={cn(
                            conv.is_starred
                              ? "fill-accent text-accent"
                              : "text-muted-foreground/30"
                          )}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
