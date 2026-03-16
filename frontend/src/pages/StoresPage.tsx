import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  Search, Store, Users, Package, TrendingUp, Star, StarHalf,
  ShieldCheck, SlidersHorizontal, X, ArrowUpDown, Eye, ChevronDown,
  Sparkles, Crown, Flame, Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/* ─── Types ─── */
interface StoreRow {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  is_verified: boolean | null;
  verified_years: number | null;
  followers_count: number | null;
  products_count: number | null;
  sales_count: number | null;
  rating: number | null;
  is_online: boolean | null;
  created_at: string;
  followers_override: number | null;
  sales_override: number | null;
  verified_years_override: number | null;
  review_count_override: number | null;
}

/* ─── Sort options ─── */
const SORT_OPTIONS = [
  { value: "popular", label: "Plus populaires", icon: Flame },
  { value: "rating", label: "Mieux notés", icon: Star },
  { value: "sales", label: "Plus de ventes", icon: TrendingUp },
  { value: "followers", label: "Plus d'abonnés", icon: Users },
  { value: "products", label: "Plus d'articles", icon: Package },
  { value: "newest", label: "Plus récents", icon: Clock },
];

/* ─── Helpers ─── */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toString();
}

function renderStars(rating: number) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.3;
  const stars = [];
  for (let i = 0; i < full; i++)
    stars.push(<Star key={`f${i}`} size={13} className="fill-amber-400 text-amber-400" />);
  if (half)
    stars.push(<StarHalf key="h" size={13} className="fill-amber-400 text-amber-400" />);
  const empty = 5 - stars.length;
  for (let i = 0; i < empty; i++)
    stars.push(<Star key={`e${i}`} size={13} className="text-border" />);
  return stars;
}

/* ─── Stat Pill ─── */
function StatPill({ icon: Icon, value, label, highlight = false }: {
  icon: React.ElementType; value: string | number; label: string; highlight?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
      highlight
        ? "bg-primary/10 text-primary"
        : "bg-muted text-muted-foreground"
    )}>
      <Icon size={12} className={highlight ? "text-primary" : "text-muted-foreground"} />
      <span className="font-bold">{value}</span>
      <span className="hidden sm:inline opacity-70">{label}</span>
    </div>
  );
}

/* ─── Store Card ─── */
function StoreCard({ store }: { store: StoreRow }) {
  const followers = store.followers_override ?? store.followers_count ?? 0;
  const sales = store.sales_override ?? store.sales_count ?? 0;
  const products = store.products_count ?? 0;
  const rating = store.rating ?? 0;
  const verified = store.is_verified;
  const verifiedYears = store.verified_years_override ?? store.verified_years ?? 0;

  return (
    <Link
      to={`/store/${store.id}`}
      className="group relative flex flex-col bg-card border border-border rounded-xl overflow-hidden transition-all duration-300 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5"
    >
      {/* Banner */}
      <div className="relative h-28 sm:h-32 overflow-hidden bg-primary/10">
        {store.banner_url ? (
          <img
            src={store.banner_url}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-primary/15" />
        )}
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />

        {/* Online indicator */}
        {store.is_online && (
          <span className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-card/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-emerald-600 shadow-sm border border-border">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            En ligne
          </span>
        )}

        {/* Verified badge */}
        {verified && (
          <span className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-semibold shadow-sm">
            <ShieldCheck size={11} /> Vérifié
            {verifiedYears > 0 && <span>· {verifiedYears}a</span>}
          </span>
        )}
      </div>

      {/* Avatar — overlapping */}
      <div className="relative -mt-10 px-4 z-10">
        <div className="relative w-[72px] h-[72px] rounded-2xl border-[3px] border-card shadow-lg overflow-hidden bg-muted">
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={store.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-primary flex items-center justify-center">
              <Store size={28} className="text-primary-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-2 pb-4 flex flex-col gap-2.5">
        {/* Name + rating row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
              {store.name}
            </h3>
            {store.description && (
              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 leading-relaxed">
                {store.description}
              </p>
            )}
          </div>
          {/* Star rating compact */}
          <div className="shrink-0 flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-0.5">
              {renderStars(rating)}
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">
              {rating > 0 ? rating.toFixed(1) : "—"}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-1.5">
          <StatPill icon={TrendingUp} value={formatCount(sales)} label="ventes" highlight={sales > 50} />
          <StatPill icon={Users} value={formatCount(followers)} label="abonnés" highlight={followers > 100} />
          <StatPill icon={Package} value={formatCount(products)} label="articles" />
        </div>

        {/* CTA */}
        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Depuis {new Date(store.created_at).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Eye size={13} /> Voir la boutique
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ─── Skeleton ─── */
function StoreCardSkeleton() {
  return (
    <div className="flex flex-col bg-card border border-border rounded-xl overflow-hidden">
      <Skeleton className="h-28 sm:h-32 rounded-none" />
      <div className="relative -mt-10 px-4 z-10">
        <Skeleton className="w-[72px] h-[72px] rounded-2xl" />
      </div>
      <div className="px-4 pt-2 pb-4 space-y-3">
        <div>
          <Skeleton className="h-4 w-32 mb-1" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="flex gap-1.5">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

/* ─── Filter Chips ─── */
const FILTER_OPTIONS = [
  { value: "all", label: "Toutes", icon: Store },
  { value: "verified", label: "Vérifiées", icon: ShieldCheck },
  { value: "online", label: "En ligne", icon: Sparkles },
  { value: "top_rated", label: "Top noté", icon: Crown },
];

/* ═══════════════ PAGE ═══════════════ */
export default function StoresPage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("popular");
  const [filter, setFilter] = useState("all");

  const { data: stores, isLoading } = useQuery({
    queryKey: ["all-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, description, logo_url, banner_url, is_verified, verified_years, followers_count, products_count, sales_count, rating, is_online, created_at, followers_override, sales_override, verified_years_override, review_count_override")
        .order("sales_count", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StoreRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!stores) return [];
    let result = [...stores];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q))
      );
    }

    // Filter chips
    switch (filter) {
      case "verified":
        result = result.filter((s) => s.is_verified);
        break;
      case "online":
        result = result.filter((s) => s.is_online);
        break;
      case "top_rated":
        result = result.filter((s) => (s.rating ?? 0) >= 4);
        break;
    }

    // Sort
    const getFollowers = (s: StoreRow) => s.followers_override ?? s.followers_count ?? 0;
    const getSales = (s: StoreRow) => s.sales_override ?? s.sales_count ?? 0;

    switch (sortBy) {
      case "rating":
        result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case "sales":
        result.sort((a, b) => getSales(b) - getSales(a));
        break;
      case "followers":
        result.sort((a, b) => getFollowers(b) - getFollowers(a));
        break;
      case "products":
        result.sort((a, b) => (b.products_count ?? 0) - (a.products_count ?? 0));
        break;
      case "newest":
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "popular":
      default:
        result.sort((a, b) => {
          const scoreA = getSales(a) * 2 + getFollowers(a) + (a.products_count ?? 0) + (a.rating ?? 0) * 10;
          const scoreB = getSales(b) * 2 + getFollowers(b) + (b.products_count ?? 0) + (b.rating ?? 0) * 10;
          return scoreB - scoreA;
        });
        break;
    }

    return result;
  }, [stores, search, filter, sortBy]);

  const totalStores = stores?.length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pb-24">
        {/* ═══ HERO ═══ */}
        <section className="relative overflow-hidden bg-primary py-12 md:py-16">
          {/* Decorative elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 bg-black/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-black/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
          </div>

          <div className="container relative z-10 text-center space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 backdrop-blur-sm px-4 py-1.5 text-xs font-medium text-primary-foreground/90">
              <Store size={14} />
              {isLoading ? "..." : `${totalStores} boutiques`} sur Zandofy
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-primary-foreground tracking-tight">
              Explorez nos <span className="underline decoration-primary-foreground/30 decoration-4 underline-offset-4">Boutiques</span>
            </h1>
            <p className="text-sm md:text-base text-primary-foreground/80 max-w-xl mx-auto leading-relaxed">
              Comparez les vendeurs, découvrez leurs produits et trouvez les boutiques qui correspondent à vos besoins.
            </p>

            {/* Search bar */}
            <div className="max-w-lg mx-auto relative mt-2">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une boutique..."
                className="pl-10 pr-10 h-12 rounded-full bg-card border-border shadow-lg text-sm placeholder:text-muted-foreground/70"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ═══ TOOLBAR ═══ */}
        <div className="container pt-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Filter chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-1">
              {FILTER_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-200 border",
                    filter === value
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>

            {/* Sort + count */}
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
              </span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-8 w-[180px] text-xs rounded-full border-border">
                  <ArrowUpDown size={12} className="mr-1.5 shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <SelectItem key={value} value={value} className="text-xs">
                      <span className="flex items-center gap-1.5">
                        <Icon size={12} /> {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ═══ GRID ═══ */}
        <div className="container">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <StoreCardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <Store size={48} className="mx-auto text-muted-foreground/20" />
              <h2 className="text-lg font-semibold text-foreground">Aucune boutique trouvée</h2>
              <p className="text-sm text-muted-foreground">
                {search
                  ? `Aucun résultat pour « ${search} ». Essayez un autre terme.`
                  : "Aucune boutique ne correspond aux filtres sélectionnés."}
              </p>
              {(search || filter !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSearch(""); setFilter("all"); }}
                  className="mt-2"
                >
                  <X size={14} className="mr-1.5" /> Effacer les filtres
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((store) => (
                <StoreCard key={store.id} store={store} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
