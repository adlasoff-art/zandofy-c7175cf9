import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Clock, Eye, Search, ChevronLeft, ChevronRight, ArrowRight, Calendar, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";

const sb = supabase as any;

import blogHeroImg from "@/assets/blog/blog-ecommerce-trends.jpg";

const POSTS_PER_PAGE = 12;

const BlogPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["blog-categories"],
    queryFn: async () => {
      const { data } = await sb
        .from("blog_categories")
        .select("*")
        .order("sort_order");
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: postsData, isLoading } = useQuery({
    queryKey: ["blog-posts", page, selectedCategory, selectedTag, search],
    queryFn: async () => {
      let query = sb
        .from("blog_posts")
        .select("*, blog_categories(name, slug, color)", { count: "exact" })
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (selectedCategory) query = query.eq("category_id", selectedCategory);
      if (selectedTag) query = query.contains("tags", [selectedTag]);
      if (search.trim()) query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);

      const from = (page - 1) * POSTS_PER_PAGE;
      query = query.range(from, from + POSTS_PER_PAGE - 1);

      const { data, count, error } = await query;
      if (error) throw error;
      return { posts: data || [], total: count || 0 };
    },
    staleTime: 60 * 1000,
  });

  const posts = postsData?.posts || [];
  const totalPages = Math.ceil((postsData?.total || 0) / POSTS_PER_PAGE);

  const featuredPost = posts[0];
  const gridPosts = posts.slice(1);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    posts.forEach((p: any) => p.tags?.forEach((t: string) => tags.add(t)));
    return Array.from(tags).slice(0, 10);
  }, [posts]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* SEO meta tags are set via document.title */}
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-foreground">
        <div className="absolute inset-0">
          <img src={blogHeroImg} alt="" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground via-foreground/80 to-transparent" />
        </div>
        <div className="relative container py-16 md:py-24">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-primary mb-4">
              <Tag size={12} /> Le Blog Zandofy
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-card leading-[1.1] mb-4">
              Tendances, Conseils<br />& <span className="text-primary">Inspiration</span>
            </h1>
            <p className="text-card/70 text-base md:text-lg max-w-lg leading-relaxed">
              Explorez nos articles sur la mode africaine, le e-commerce, les conseils vendeurs et les innovations qui transforment le commerce en ligne.
            </p>
          </div>
        </div>
      </section>

      <main className="container py-8 md:py-12 flex-1">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-10">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un article..."
              className="pl-10"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setSelectedCategory(null); setPage(1); }}
              className={`px-4 py-2 text-xs font-medium rounded-full border transition-colors ${
                !selectedCategory ? "bg-foreground text-card border-foreground" : "bg-card text-foreground border-border hover:border-foreground"
              }`}
            >
              Tous
            </button>
            {categories?.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id === selectedCategory ? null : cat.id); setPage(1); }}
                className={`px-4 py-2 text-xs font-medium rounded-full border transition-colors ${
                  selectedCategory === cat.id ? "bg-foreground text-card border-foreground" : "bg-card text-foreground border-border hover:border-foreground"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-8">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => { setSelectedTag(selectedTag === tag ? null : tag); setPage(1); }}
                className={`px-3 py-1 text-[11px] rounded-full border transition-colors ${
                  selectedTag === tag
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-muted animate-pulse rounded-2xl h-80" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">Aucun article trouvé.</p>
          </div>
        ) : (
          <>
            {/* Featured post */}
            {featuredPost && page === 1 && !search && !selectedCategory && !selectedTag && (
              <Link
                to={`/blog/${featuredPost.slug}`}
                className="group block mb-10 rounded-3xl overflow-hidden bg-card border border-border hover:shadow-xl transition-all duration-500"
              >
                <div className="grid md:grid-cols-2">
                  <div className="aspect-[16/10] md:aspect-auto overflow-hidden">
                    {featuredPost.cover_image_url ? (
                      <img
                        src={featuredPost.cover_image_url}
                        alt={featuredPost.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center min-h-[280px]">
                        <Tag size={48} className="text-primary/30" />
                      </div>
                    )}
                  </div>
                  <div className="p-8 md:p-10 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-4">
                      {featuredPost.blog_categories && (
                        <span
                          className="px-3 py-1 text-[11px] font-semibold rounded-full text-card"
                          style={{ backgroundColor: (featuredPost.blog_categories as any).color || "hsl(var(--primary))" }}
                        >
                          {(featuredPost.blog_categories as any).name}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">À la une</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors leading-tight">
                      {featuredPost.title}
                    </h2>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6 line-clamp-3">
                      {featuredPost.excerpt}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(featuredPost.published_at || featuredPost.created_at)}</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {featuredPost.reading_time_min} min</span>
                      <span className="flex items-center gap-1"><Eye size={12} /> {featuredPost.views_count}</span>
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                      Lire l'article <ArrowRight size={16} />
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(page === 1 && !search && !selectedCategory && !selectedTag ? gridPosts : posts).map((post: any) => (
                <Link
                  key={post.id}
                  to={`/blog/${post.slug}`}
                  className="group flex flex-col rounded-2xl overflow-hidden bg-card border border-border hover:shadow-lg hover:-translate-y-1 transition-all duration-400"
                >
                  <div className="aspect-[16/10] overflow-hidden relative">
                    {post.cover_image_url ? (
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                        <Tag size={32} className="text-muted-foreground/30" />
                      </div>
                    )}
                    {post.blog_categories && (
                      <span
                        className="absolute top-3 left-3 px-3 py-1 text-[10px] font-bold rounded-full text-card backdrop-blur-sm"
                        style={{ backgroundColor: `${(post.blog_categories as any).color || "hsl(var(--primary))"}dd` }}
                      >
                        {(post.blog_categories as any).name}
                      </span>
                    )}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-bold text-foreground text-base mb-2 line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                      {post.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed flex-1">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-3 border-t border-border">
                      <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(post.published_at || post.created_at)}</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><Clock size={11} /> {post.reading_time_min} min</span>
                        <span className="flex items-center gap-1"><Eye size={11} /> {post.views_count}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-border bg-card text-foreground disabled:opacity-30 hover:bg-muted transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="text-muted-foreground">…</span>
                      )}
                      <button
                        onClick={() => setPage(p)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                          page === p
                            ? "bg-foreground text-card"
                            : "border border-border bg-card text-foreground hover:bg-muted"
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-border bg-card text-foreground disabled:opacity-30 hover:bg-muted transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default BlogPage;
