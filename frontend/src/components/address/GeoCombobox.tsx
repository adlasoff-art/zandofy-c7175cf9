/**
 * Generic searchable combobox for geographic fields.
 * Used for Province, City, Commune, Quartier selection.
 */
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface GeoOption {
  value: string;
  label: string;
}

interface GeoComboboxProps {
  options: GeoOption[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function GeoCombobox({ options, value, onChange, label, placeholder = "Sélectionner...", disabled }: GeoComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile && open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isMobile, open]);

  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));
  const selectedLabel = options.find((o) => o.value === value)?.label;

  const handleSelect = (v: string) => {
    onChange(v);
    setOpen(false);
    setSearch("");
  };

  const listContent = (
    <>
      {filtered.length === 0 && (
        <div className="px-4 py-3 text-sm text-muted-foreground">Aucun résultat</div>
      )}
      {filtered.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => handleSelect(o.value)}
          className="w-full px-4 py-2.5 text-sm text-left hover:bg-muted flex items-center gap-2"
        >
          <span className="w-4">{value === o.value && <Check size={14} className="text-primary" />}</span>
          <span>{o.label}</span>
        </button>
      ))}
    </>
  );

  return (
    <div ref={ref} className="relative">
      {label && <label className="text-xs text-muted-foreground">{label}</label>}
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={selectedLabel ? "text-foreground" : "text-muted-foreground"}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown size={14} className="text-muted-foreground" />
      </button>

      {open && isMobile && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <button type="button" onClick={() => { setOpen(false); setSearch(""); }} className="text-muted-foreground">
              <X size={20} />
            </button>
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher..."
                className="w-full pl-9 pr-3 py-2 text-base bg-muted border-none rounded-lg outline-none"
                style={{ fontSize: "16px" }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">{listContent}</div>
        </div>
      )}

      {open && !isMobile && (
        <div
          className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-52 overflow-hidden left-0 right-0"
          style={{
            position: "fixed",
            width: ref.current?.getBoundingClientRect().width,
            left: ref.current?.getBoundingClientRect().left,
            top: (ref.current?.getBoundingClientRect().bottom || 0) + 4,
          }}
        >
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher..."
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-muted border-none rounded outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-40">{listContent}</div>
        </div>
      )}
    </div>
  );
}
