import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RatingSummary } from "./RatingSummary";
import { ReviewForm } from "./ReviewForm";
import { ReviewList, type ReviewData } from "./ReviewList";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, ArrowUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductReviewsProps {
  productId: string;
}

const PAGE_SIZE = 5;

export function ProductReviews({ productId }: ProductReviewsProps) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "photos" | number>("all");
  const [sortBy, setSortBy] = useState<"recent" | "helpful">("recent");
  const [page, setPage] = useState(1);

  // Fetch rating summary via RPC
  const { data: summary } = useQuery({
    queryKey: ["rating-summary", productId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_product_rating_summary", {
        p_product_id: productId,
      });
      if (error) throw error;
      return data?.[0] || {
        avg_rating: 0,
        total_reviews: 0,
        star_1: 0,
        star_2: 0,
        star_3: 0,
        star_4: 0,
        star_5: 0,
      };
    },
  });

  // Fetch approved reviews with profiles join
  const { data: reviews, isLoading } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reviews")
        .select("*")
        .eq("product_id", productId)
        .eq("is_approved", true)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch profiles for review authors
      const userIds = [...new Set((data || []).map((r: any) => r.user_id))] as string[];
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, avatar_url")
          .in("id", userIds);
        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
        }
      }

      return (data || []).map((r: any) => {
        const { user_id, ...rest } = r;
        return {
          ...rest,
          user_id,
          profiles: profilesMap[user_id] || null,
        } as ReviewData;
      });
    },
  });

  const distribution = useMemo(
    () => ({
      1: Number(summary?.star_1 || 0),
      2: Number(summary?.star_2 || 0),
      3: Number(summary?.star_3 || 0),
      4: Number(summary?.star_4 || 0),
      5: Number(summary?.star_5 || 0),
    }),
    [summary]
  );

  const filteredAndSorted = useMemo(() => {
    if (!reviews) return [];
    let result = [...reviews];

    // Filter
    if (filter === "photos")
      result = result.filter((r) => r.images && r.images.length > 0);
    else if (typeof filter === "number")
      result = result.filter((r) => r.rating === filter);

    // Sort
    if (sortBy === "helpful")
      result.sort((a, b) => b.helpful_count - a.helpful_count);
    else
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return result;
  }, [reviews, filter, sortBy]);

  // Reset page when filter/sort changes
  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedReviews = filteredAndSorted.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleFilterChange = (f: "all" | "photos" | number) => {
    setFilter(f);
    setPage(1);
  };

  return (
    <section className="mt-12 border-t border-border pt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">
          Avis clients ({summary?.total_reviews || 0})
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(!showForm)}
        >
          <MessageSquarePlus size={16} className="mr-1" />
          Donner mon avis
        </Button>
      </div>

      {showForm && (
        <div className="mb-6">
          <ReviewForm
            productId={productId}
            onSuccess={() => setShowForm(false)}
          />
        </div>
      )}

      <RatingSummary
        avgRating={Number(summary?.avg_rating || 0)}
        totalReviews={Number(summary?.total_reviews || 0)}
        distribution={distribution}
        activeFilter={filter}
        onFilterChange={handleFilterChange}
      />

      {/* Sort */}
      <div className="flex items-center justify-end mt-4 gap-2">
        <ArrowUpDown size={14} className="text-muted-foreground" />
        <Select value={sortBy} onValueChange={(v) => { setSortBy(v as any); setPage(1); }}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Plus récents</SelectItem>
            <SelectItem value="helpful">Plus utiles</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4">
        <ReviewList reviews={paginatedReviews} isLoading={isLoading} />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Précédent
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </Button>
        </div>
      )}
    </section>
  );
}
