/**
 * Generic searchable combobox with optional thumbnails and sublabels.
 * Mobile: fullscreen modal. Desktop: fixed-positioned dropdown.
 */
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
  imageUrl?: string;
}

interface SearchableComboboxProps {
  options: SearchableOption[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsLabel?: string;
  noneLabel?: string;
  showNone?: boolean;
  disabled?: boolean;
}

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

export function SearchableCombobox({
  options,
  value,
  onChange,
  label,
  placeholder = "Sélectionner...",
  searchPlaceholder = "Rechercher...",
  noResultsLabel = "Aucun résultat",
  noneLabel = "— Aucun —",
  showNone = true,
  disabled,
}: SearchableComboboxProps) {
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

  const q = normalize(search);
  const filtered = q
    ? options.filter((o) =>
        normalize(o.label).includes(q) ||
        (o.sublabel && normalize(o.sublabel).includes(q))
      )
    : options;

  const selected = options.find((o) => o.value === value);

  const handleSelect = (v: string) => {
    onChange(v);
    setOpen(false);
    setSearch("");
  };

  const renderRow = (o: SearchableOption) => (
    <button
      key={o.value}
      type="button"
      onClick={() => handleSelect(o.value)}
      className="w-full px-4 py-2.5 text-sm text-left hover:bg-muted flex items-center gap-3"
    >
      <span className="w-4 flex-shrink-0">
        {value === o.value && <Check size={14} className="text-primary" />}
      </span>
      {o.imageUrl && (
        <img
          src={o.imageUrl}
          alt=""
          className="w-8 h-8 rounded object-cover border border-border flex-shrink-0"
        />
      )}
      <span className="flex-1 min-w-0">
        <span className="block truncate">{o.label}</span>
        {o.sublabel && (
          <span className="block text-xs text-muted-foreground truncate">{o.sublabel}</span>
        )}
      </span>
    </button>
  );

  const listContent = (
    <>
      {showNone && (
        <button
          type="button"
          onClick={() => handleSelect("")}
          className="w-full px-4 py-2.5 text-sm text-left hover:bg-muted flex items-center gap-2"
        >
          <span className="w-4">{!value && <Check size={14} className="text-primary" />}</span>
          <span className="text-muted-foreground">{noneLabel}</span>
        </button>
      )}
      {filtered.length === 0 && (
        <div className="px-4 py-3 text-sm text-muted-foreground">{noResultsLabel}</div>
      )}
      {filtered.map(renderRow)}
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
        <span className={`flex items-center gap-2 min-w-0 ${selected ? "text-foreground" : "text-muted-foreground"}`}>
          {selected?.imageUrl && (
            <img src={selected.imageUrl} alt="" className="w-5 h-5 rounded object-cover border border-border flex-shrink-0" />
          )}
          <span className="truncate">
            {selected ? selected.label : placeholder}
            {selected?.sublabel ? <span className="text-muted-foreground"> ({selected.sublabel})</span> : null}
          </span>
        </span>
        <ChevronDown size={14} className="text-muted-foreground flex-shrink-0 ml-2" />
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
                placeholder={searchPlaceholder}
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
          className="z-50 bg-card border border-border rounded-md shadow-lg overflow-hidden"
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
                placeholder={searchPlaceholder}
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-muted border-none rounded outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-64">{listContent}</div>
        </div>
      )}
    </div>
  );
}