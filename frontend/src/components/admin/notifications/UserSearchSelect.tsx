import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, X, User } from "lucide-react";

interface SelectedUser {
  id: string;
  email: string;
  name: string;
}

interface UserSearchSelectProps {
  selectedUsers: SelectedUser[];
  onChange: (users: SelectedUser[]) => void;
}

export function UserSearchSelect({ selectedUsers, onChange }: UserSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SelectedUser[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      const q = query.trim();
      const { data } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .limit(10);
      setResults(
        (data || []).map((p) => ({
          id: p.id,
          email: p.email || "",
          name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || p.id.slice(0, 8),
        }))
      );
      setLoading(false);
      setOpen(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addUser = (u: SelectedUser) => {
    if (!selectedUsers.find((s) => s.id === u.id)) onChange([...selectedUsers, u]);
    setQuery("");
    setOpen(false);
  };

  const removeUser = (id: string) => onChange(selectedUsers.filter((u) => u.id !== id));

  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground flex items-center gap-1">
        <User size={12} />
        Utilisateur(s) spécifique(s)
      </label>

      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map((u) => (
            <span key={u.id} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
              {u.name}
              <button onClick={() => removeUser(u.id)} className="hover:text-destructive"><X size={10} /></button>
            </span>
          ))}
        </div>
      )}

      <div ref={wrapperRef} className="relative">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom ou email..."
            className="w-full pl-8 pr-3 py-1.5 bg-muted border border-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {open && results.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {results.map((u) => (
              <button
                key={u.id}
                onClick={() => addUser(u)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center gap-2"
              >
                <User size={12} className="text-muted-foreground shrink-0" />
                <span className="font-medium text-foreground">{u.name}</span>
                <span className="text-muted-foreground ml-auto truncate">{u.email}</span>
              </button>
            ))}
          </div>
        )}

        {open && query.length >= 2 && results.length === 0 && !loading && (
          <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg px-3 py-4 text-xs text-muted-foreground text-center">
            Aucun utilisateur trouvé
          </div>
        )}
      </div>
    </div>
  );
}

export type { SelectedUser };
