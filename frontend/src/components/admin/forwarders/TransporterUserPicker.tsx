import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Search, X, UserCircle2 } from "lucide-react";

const sb = supabase as any;

interface UserHit {
  id: string;
  email: string | null;
  display_label: string;
}

interface Props {
  value: string | null | undefined;
  onChange: (userId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Admin-only user picker. Calls the SECURITY DEFINER RPC `admin_search_users`
 * to look up profiles by email or name. Never exposes the full profiles table.
 */
export function TransporterUserPicker({ value, onChange, placeholder, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  // 250ms debounce to limit RPC traffic
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Resolve current value's label (separate query so we keep showing it even after refresh)
  const { data: currentLabel } = useQuery({
    queryKey: ["admin-user-label", value],
    enabled: !!value,
    queryFn: async () => {
      const { data, error } = await sb.rpc("admin_get_user_label", { p_user_id: value });
      if (error) return null;
      return (data?.[0] ?? null) as { id: string; email: string; display_label: string } | null;
    },
  });

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["admin-search-users", debounced],
    enabled: open && debounced.length >= 2,
    queryFn: async () => {
      const { data, error } = await sb.rpc("admin_search_users", { p_query: debounced, p_limit: 12 });
      if (error) throw error;
      return (data ?? []) as UserHit[];
    },
  });

  const buttonLabel = useMemo(() => {
    if (!value) return placeholder ?? "Aucun compte lié";
    if (currentLabel) return currentLabel.display_label || currentLabel.email || value;
    return "…";
  }, [value, currentLabel, placeholder]);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="flex-1 justify-start font-normal h-9"
          >
            <UserCircle2 size={14} className="mr-2 opacity-60 shrink-0" />
            <span className="truncate">{buttonLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-2" align="start">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Email, prénom ou nom (min. 2 caractères)"
              className="pl-7 h-9"
            />
          </div>

          <div className="mt-2 max-h-64 overflow-y-auto">
            {debounced.length < 2 ? (
              <p className="text-xs text-muted-foreground px-2 py-3 text-center">
                Tapez au moins 2 caractères…
              </p>
            ) : isFetching ? (
              <div className="flex justify-center py-3">
                <Loader2 className="animate-spin text-primary" size={14} />
              </div>
            ) : hits.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-3 text-center">
                Aucun utilisateur trouvé.
              </p>
            ) : (
              <ul className="space-y-1">
                {hits.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm"
                      onClick={() => {
                        onChange(u.id);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <div className="font-medium truncate">{u.display_label}</div>
                      {u.email && u.email !== u.display_label && (
                        <div className="text-[11px] text-muted-foreground truncate">{u.email}</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {value && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onChange(null)}
          title="Délier"
        >
          <X size={14} />
        </Button>
      )}
    </div>
  );
}