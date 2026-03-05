import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Search, Camera, TrendingUp, Clock, X, Loader2 } from "lucide-react";
import { autocompleteProducts } from "@/services/search";
import type { Product } from "@/services/api";
import { useI18n } from "@/contexts/I18nContext";
import { apiFetch } from "@/services/api-client";
import { useToast } from "@/hooks/use-toast";

interface PredictiveSearchProps {
  mobile?: boolean;
  onClose?: () => void;
}

const TRENDING_SEARCHES = ["Robe été", "Sac à main", "Sneakers", "Montre", "T-shirt"];

export function PredictiveSearch({ mobile, onClose }: PredictiveSearchProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visualLoading, setVisualLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();
  const { toast } = useToast();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced autocomplete
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await autocompleteProducts(query);
      setSuggestions(results);
      setLoading(false);
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    setOpen(false);
    onClose?.();
  };

  const handleTrendClick = (term: string) => {
    setQuery(term);
    navigate(`/search?q=${encodeURIComponent(term)}`);
    setOpen(false);
    onClose?.();
  };

  const handleSuggestionClick = () => {
    setOpen(false);
    onClose?.();
  };

  const handleFileUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Image trop volumineuse", description: "Maximum 5 Mo.", variant: "destructive" });
        return;
      }
      setVisualLoading(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        try {
          const data = await apiFetch<{ keywords?: { keywords_fr?: string[] }; products?: unknown[] }>("/api/visual-search", {
            method: "POST",
            body: JSON.stringify({ image_base64: base64 }),
          });
          sessionStorage.setItem("visual-search-results", JSON.stringify(data));
          navigate("/search?visual=true");
          onClose?.();
          if (!data?.products?.length) {
            toast({ title: "Aucun produit trouvé", description: "Les mots-clés détectés sont affichés sur la page." });
          }
        } catch (err) {
          console.error("Visual search error:", err);
          toast({ title: "Erreur", description: "Impossible d'analyser l'image.", variant: "destructive" });
        } finally {
          setVisualLoading(false);
        }
      };
      reader.readAsDataURL(file);
      input.value = "";
    };
    input.click();
  };

  const showDropdown = open && (query.length >= 2 || query.length === 0);

  return (
    <div ref={wrapperRef} className={`relative w-full ${mobile ? 'overflow-visible' : ''}`}>
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={t("search.placeholder")}
          className="w-full pl-4 pr-20 py-2 text-[16px] sm:text-sm bg-muted rounded-full border border-border outline-none focus:border-primary placeholder:text-muted-foreground"
          autoFocus={mobile}
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setSuggestions([]); }}
            className="absolute right-[4.5rem] top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={13} />
          </button>
        )}
        <button
          type="button"
          onClick={handleFileUpload}
          disabled={visualLoading}
          className="absolute right-10 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          aria-label="Recherche visuelle"
        >
          {visualLoading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
        </button>
        <button
          type="submit"
          className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-foreground text-card rounded-full"
        >
          <Search size={14} />
        </button>
      </form>

      {/* Dropdown */}
      {showDropdown && (
        <div className={`absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-[60] overflow-hidden ${mobile ? 'max-h-[60vh]' : 'max-h-[400px]'} overflow-y-auto`}>
          {/* Suggestions */}
          {query.length >= 2 && suggestions.length > 0 && (
            <div className="py-1">
              {suggestions.map((p) => (
                <Link
                  key={p.id}
                  to={`/product/${p.id}`}
                  onClick={handleSuggestionClick}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors"
                >
                  <img src={p.image} alt="" className="w-10 h-10 object-cover rounded border border-border" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-xs text-primary font-semibold">{p.currency} {p.price.toFixed(2)}</p>
                  </div>
                </Link>
              ))}
              <button
                onClick={handleSubmit}
                className="w-full text-xs text-primary font-medium py-2 hover:bg-muted transition-colors border-t border-border"
              >
                {t("search.viewAllResults")} « {query} »
              </button>
            </div>
          )}

          {/* Loading */}
          {query.length >= 2 && loading && suggestions.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">{t("search.searching")}</div>
          )}

          {/* No results */}
          {query.length >= 2 && !loading && suggestions.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              {t("search.noResultsFor")} « {query} »
            </div>
          )}

          {/* Trending (when empty query) */}
          {query.length < 2 && (
            <div className="py-2">
              <p className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("search.trending")}</p>
              {TRENDING_SEARCHES.map((term) => (
                <button
                  key={term}
                  onClick={() => handleTrendClick(term)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                >
                  <TrendingUp size={12} className="text-muted-foreground" />
                  {term}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
