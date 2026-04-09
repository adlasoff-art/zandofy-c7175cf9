import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Search, Camera, TrendingUp, X, Loader2, Upload, ImageIcon } from "lucide-react";
import { autocompleteProducts } from "@/services/search";
import type { Product } from "@/services/api";
import { useI18n } from "@/contexts/I18nContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useVisualSearchEnabled } from "@/hooks/useVisualSearchEnabled";

interface PredictiveSearchProps {
  mobile?: boolean;
  onClose?: () => void;
}

const TRENDING_SEARCHES = [
  "Robe été",
  "Sac à main",
  "Sneakers",
  "Montre",
  "Écouteurs sans fil",
  "T-shirt",
  "Chaussures femme",
];

export function PredictiveSearch({ mobile, onClose }: PredictiveSearchProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visualLoading, setVisualLoading] = useState(false);
  const [visualModalOpen, setVisualModalOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);
  const [hoveredSuggestion, setHoveredSuggestion] = useState<string | null>(null);
  const [previewProducts, setPreviewProducts] = useState<Product[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();
  const { toast } = useToast();
  const { enabled: visualSearchEnabled } = useVisualSearchEnabled();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Animated placeholder rotation
  useEffect(() => {
    if (query.length > 0) return;
    const interval = setInterval(() => {
      setPlaceholderVisible(false);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % TRENDING_SEARCHES.length);
        setPlaceholderVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, [query]);

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
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHoveredSuggestion(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Preview products on hover
  const handleSuggestionHover = useCallback((productName: string) => {
    setHoveredSuggestion(productName);
    clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const results = await autocompleteProducts(productName);
        setPreviewProducts(results.slice(0, 4));
      } catch {
        setPreviewProducts([]);
      }
      setPreviewLoading(false);
    }, 150);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    // Save to search history
    try {
      const history = JSON.parse(localStorage.getItem("search_history") || "[]") as string[];
      const updated = [query.trim(), ...history.filter((h) => h !== query.trim())].slice(0, 5);
      localStorage.setItem("search_history", JSON.stringify(updated));
    } catch { /* ignore */ }
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

  const compressImage = (file: File, maxWidth = 1024, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  };

  const processVisualSearch = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Image trop volumineuse", description: "Maximum 10 Mo.", variant: "destructive" });
      return;
    }
    setVisualLoading(true);
    setVisualModalOpen(false);
    try {
      const base64 = await compressImage(file);
      const { data, error } = await supabase.functions.invoke("visual-search", {
        body: { image_base64: base64 },
      });
      if (error) throw error;
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processVisualSearch(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processVisualSearch(file);
    }
  };

  const handlePaste = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], "clipboard.png", { type: imageType });
          processVisualSearch(file);
          return;
        }
      }
    } catch { /* ignore */ }
  }, []);

  const searchHistory = (() => {
    try {
      return JSON.parse(localStorage.getItem("search_history") || "[]") as string[];
    } catch {
      return [];
    }
  })();

  const showDropdown = open && (query.length >= 2 || query.length === 0);
  const animatedPlaceholder = query.length === 0 ? TRENDING_SEARCHES[placeholderIndex] : "";

  return (
    <>
      <div ref={wrapperRef} className={`relative w-full ${mobile ? "overflow-visible" : ""}`}>
        <form onSubmit={handleSubmit} className="relative flex items-center h-10">
          {/* Search input with animated placeholder */}
          <div className="relative flex-1 h-full">
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder=""
              className="w-full h-full pl-4 pr-10 text-[16px] md:text-sm bg-card rounded-l-full border-2 border-r-0 border-primary/30 outline-none focus:border-primary transition-colors text-foreground"
              autoFocus={mobile}
            />
            {/* Animated placeholder */}
            {query.length === 0 && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1.5 overflow-hidden">
                <Search size={14} className="text-muted-foreground shrink-0" />
                <span
                  className={`text-muted-foreground text-sm transition-all duration-300 ${
                    placeholderVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                  }`}
                >
                  {animatedPlaceholder}
                </span>
              </div>
            )}
            {/* Clear button */}
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); setSuggestions([]); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Camera / visual search button */}
          {visualSearchEnabled && (
            <button
              type="button"
              onClick={() => setVisualModalOpen(true)}
              disabled={visualLoading}
              className="flex items-center justify-center w-10 h-full border-2 border-l-0 border-r-0 border-primary/30 bg-card text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
              aria-label="Recherche visuelle"
            >
              {visualLoading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            </button>
          )}

          {/* Search button with gradient */}
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 md:px-5 h-full bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-r-full font-semibold text-sm whitespace-nowrap hover:opacity-90 transition-opacity shrink-0"
          >
            <Search size={15} />
            <span className="hidden sm:inline">{t("search.searchBtn")}</span>
          </button>
        </form>

        {/* Dropdown */}
        {showDropdown && (
          <div className={`absolute top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-xl z-[60] overflow-hidden ${mobile ? "max-h-[60vh]" : "max-h-[460px]"} overflow-y-auto`}>
            {/* Search suggestions with preview panel */}
            {query.length >= 2 && suggestions.length > 0 && (
              <div className="flex">
                {/* Suggestions list */}
                <div className={`py-1 ${!mobile ? "flex-1 min-w-0" : "w-full"}`}>
                  {suggestions.map((p) => (
                    <Link
                      key={p.id}
                      to={`/product/${(p as any).slug || p.id}`}
                      onClick={handleSuggestionClick}
                      onMouseEnter={() => !mobile && handleSuggestionHover(p.name)}
                      onMouseLeave={() => !mobile && setHoveredSuggestion(null)}
                      className={`flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors ${hoveredSuggestion === p.name ? "bg-muted" : ""}`}
                    >
                      <img src={p.image} alt="" className="w-10 h-10 object-cover rounded-lg border border-border" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.nameFr || p.name}</p>
                        <p className="text-xs text-primary font-semibold">{p.currency} {p.price.toFixed(2)}</p>
                      </div>
                    </Link>
                  ))}
                  <button
                    onClick={handleSubmit}
                    className="w-full text-xs text-primary font-semibold py-2.5 hover:bg-muted transition-colors border-t border-border"
                  >
                    {t("search.viewAllResults")} « {query} »
                  </button>
                </div>

                {/* Preview panel (desktop only) */}
                {!mobile && hoveredSuggestion && (
                  <div className="hidden md:block w-64 border-l border-border bg-muted/30 p-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Aperçu</p>
                    {previewLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 size={16} className="animate-spin text-muted-foreground" />
                      </div>
                    ) : previewProducts.length > 0 ? (
                      <div className="space-y-2">
                        {previewProducts.map((pp) => (
                          <Link
                            key={pp.id}
                            to={`/product/${(pp as any).slug || pp.id}`}
                            onClick={handleSuggestionClick}
                            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-card transition-colors"
                          >
                            <img src={pp.image} alt="" className="w-12 h-12 object-cover rounded-md border border-border" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{pp.nameFr || pp.name}</p>
                              <p className="text-xs text-primary font-bold">{pp.currency} {pp.price.toFixed(2)}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">Aucun aperçu</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Loading */}
            {query.length >= 2 && loading && suggestions.length === 0 && (
              <div className="px-3 py-6 text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                {t("search.searching")}
              </div>
            )}

            {/* No results */}
            {query.length >= 2 && !loading && suggestions.length === 0 && (
              <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                {t("search.noResultsFor")} « {query} »
              </div>
            )}

            {/* Trending + history (when empty query) */}
            {query.length < 2 && (
              <div className="py-2">
                {/* Search history */}
                {searchHistory.length > 0 && (
                  <>
                    <p className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Historique</p>
                    {searchHistory.map((term) => (
                      <button
                        key={term}
                        onClick={() => handleTrendClick(term)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <span className="text-muted-foreground">🕐</span>
                        {term}
                      </button>
                    ))}
                    <div className="border-t border-border my-1" />
                  </>
                )}
                <p className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp size={10} />
                  {t("search.trending")}
                </p>
                {TRENDING_SEARCHES.slice(0, 6).map((term, i) => (
                  <button
                    key={term}
                    onClick={() => handleTrendClick(term)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <span className="text-xs text-primary/70 font-bold w-4">{i + 1}</span>
                    {term}
                    {i < 2 && <span className="ml-auto text-[10px] text-sale font-medium">🔥</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visual Search Modal */}
      {visualModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4" onClick={() => setVisualModalOpen(false)}>
          <div
            className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">Recherche par image</h3>
              <button onClick={() => setVisualModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <ImageIcon size={48} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-foreground font-medium mb-1">Glissez-déposez une image ici</p>
              <p className="text-xs text-muted-foreground mb-4">ou choisissez une option ci-dessous</p>

              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                {/* Upload from device */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Upload size={16} />
                  Importer une image
                </button>

                {/* Camera capture (mobile) */}
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors md:hidden"
                >
                  <Camera size={16} />
                  Prendre une photo
                </button>

                {/* Paste from clipboard */}
                <button
                  onClick={handlePaste}
                  className="hidden md:flex items-center justify-center gap-2 px-4 py-2.5 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
                >
                  Coller (Ctrl+V)
                </button>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground text-center mt-3">
              Formats supportés: JPG, PNG, WEBP • Max 5 Mo
            </p>

            {/* Hidden file inputs */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
          </div>
        </div>
      )}
    </>
  );
}
