import React, { useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Clock, Eye, Calendar, ArrowLeft, Tag, Share2, MessageCircle, Heart, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { BlogComments } from "@/components/blog/BlogComments";
import { VideoEmbed } from "@/components/blog/VideoEmbed";

const sb = supabase as any;

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const viewTracked = useRef(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*, blog_categories(name, slug, color)")
        .eq("slug", slug!)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Related posts
  const { data: relatedPosts } = useQuery({
    queryKey: ["blog-related", post?.category_id, post?.id],
    queryFn: async () => {
      let query = supabase
        .from("blog_posts")
        .select("id, title, slug, cover_image_url, reading_time_min, views_count, published_at, blog_categories(name, color)")
        .eq("status", "published")
        .neq("id", post!.id)
        .order("published_at", { ascending: false })
        .limit(3);
      if (post?.category_id) query = query.eq("category_id", post.category_id);
      const { data } = await query;
      return data || [];
    },
    enabled: !!post?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Track view
  useEffect(() => {
    if (!post?.id || viewTracked.current) return;
    viewTracked.current = true;
    const sessionId = sessionStorage.getItem("zandofy_session") || crypto.randomUUID();
    sessionStorage.setItem("zandofy_session", sessionId);
    supabase.rpc("increment_blog_post_views", { p_post_id: post.id, p_session_id: sessionId }).then();
  }, [post?.id]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: post?.title, url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
            <div className="h-12 w-full bg-muted animate-pulse rounded-lg" />
            <div className="aspect-[16/9] bg-muted animate-pulse rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-20 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Article introuvable</h1>
          <Link to="/blog" className="text-primary hover:underline">Retour au blog</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const videoEmbeds = (post.video_embeds as any[]) || [];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": post.schema_type || "BlogPosting",
    headline: post.meta_title || post.title,
    description: post.meta_description || post.excerpt,
    image: post.og_image_url || post.cover_image_url,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: { "@type": "Organization", name: "Zandofy" },
    publisher: { "@type": "Organization", name: "Zandofy", logo: { "@type": "ImageObject", url: "/logo.png" } },
    mainEntityOfPage: { "@type": "WebPage", "@id": window.location.href },
    wordCount: post.content?.split(/\s+/).length || 0,
    timeRequired: `PT${post.reading_time_min}M`,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>{post.meta_title || post.title} — Blog Zandofy</title>
        <meta name="description" content={post.meta_description || post.excerpt || ""} />
        <meta name="keywords" content={post.seo_keywords?.join(", ") || ""} />
        <meta property="og:title" content={post.meta_title || post.title} />
        <meta property="og:description" content={post.meta_description || post.excerpt || ""} />
        <meta property="og:image" content={post.og_image_url || post.cover_image_url || ""} />
        <meta property="og:type" content="article" />
        <meta property="article:published_time" content={post.published_at || ""} />
        <meta property="article:modified_time" content={post.updated_at} />
        {post.tags?.map((tag: string) => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}
        {post.canonical_url && <link rel="canonical" href={post.canonical_url} />}
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <Header />

      <article className="flex-1">
        {/* Breadcrumb */}
        <div className="container py-4">
          <nav className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Accueil</Link>
            <ChevronRight size={12} />
            <Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link>
            <ChevronRight size={12} />
            <span className="text-foreground truncate max-w-[200px]">{post.title}</span>
          </nav>
        </div>

        {/* Cover */}
        {post.cover_image_url && (
          <div className="container mb-8">
            <div className="relative rounded-3xl overflow-hidden aspect-[21/9] max-h-[460px]">
              <img
                src={post.cover_image_url}
                alt={post.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
                {post.blog_categories && (
                  <span
                    className="inline-block px-4 py-1.5 text-xs font-bold rounded-full text-card mb-4"
                    style={{ backgroundColor: (post.blog_categories as any).color || "hsl(var(--primary))" }}
                  >
                    {(post.blog_categories as any).name}
                  </span>
                )}
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-card leading-tight max-w-3xl">
                  {post.title}
                </h1>
              </div>
            </div>
          </div>
        )}

        <div className="container">
          <div className="max-w-3xl mx-auto">
            {/* Meta bar */}
            <div className="flex items-center justify-between flex-wrap gap-4 mb-8 pb-6 border-b border-border">
              <div className="flex items-center gap-5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-primary" />
                  {formatDate(post.published_at || post.created_at)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-primary" />
                  {post.reading_time_min} min de lecture
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye size={14} className="text-primary" />
                  {post.views_count} vues
                </span>
              </div>
              <button
                onClick={handleShare}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Share2 size={14} /> Partager
              </button>
            </div>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-8">
                {post.tags.map((tag: string) => (
                  <Link
                    key={tag}
                    to={`/blog?tag=${tag}`}
                    className="px-3 py-1 text-[11px] rounded-full bg-muted/60 text-muted-foreground hover:bg-muted transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-lg md:text-xl text-foreground/80 font-medium leading-relaxed mb-8 border-l-4 border-primary pl-6 italic">
                {post.excerpt}
              </p>
            )}

            {/* Content */}
            <div
              className="prose prose-lg max-w-none
                prose-headings:text-foreground prose-headings:font-bold
                prose-p:text-foreground/80 prose-p:leading-relaxed
                prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                prose-strong:text-foreground
                prose-blockquote:border-l-primary prose-blockquote:text-foreground/70
                prose-img:rounded-xl prose-img:shadow-md
                prose-li:text-foreground/80
                mb-10"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Video embeds */}
            {videoEmbeds.length > 0 && (
              <div className="space-y-8 mb-10">
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                  🎬 Vidéos associées
                </h3>
                {videoEmbeds.map((embed: any, idx: number) => (
                  <VideoEmbed key={idx} {...embed} />
                ))}
              </div>
            )}

            {/* Comments */}
            <BlogComments postId={post.id} />

            {/* Back link */}
            <div className="mt-12 pt-8 border-t border-border">
              <Link
                to="/blog"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={16} /> Retour au blog
              </Link>
            </div>
          </div>
        </div>

        {/* Related posts */}
        {relatedPosts && relatedPosts.length > 0 && (
          <section className="bg-muted/30 mt-16 py-12">
            <div className="container">
              <h2 className="text-2xl font-bold text-foreground mb-8">Articles similaires</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedPosts.map((rp: any) => (
                  <Link
                    key={rp.id}
                    to={`/blog/${rp.slug}`}
                    className="group rounded-2xl overflow-hidden bg-card border border-border hover:shadow-lg transition-all duration-300"
                  >
                    <div className="aspect-[16/10] overflow-hidden">
                      {rp.cover_image_url ? (
                        <img src={rp.cover_image_url} alt={rp.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center"><Tag size={24} className="text-muted-foreground/30" /></div>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-foreground text-sm mb-2 line-clamp-2 group-hover:text-primary transition-colors">{rp.title}</h3>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock size={11} /> {rp.reading_time_min} min</span>
                        <span className="flex items-center gap-1"><Eye size={11} /> {rp.views_count}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </article>
      <Footer />
    </div>
  );
};

export default BlogPostPage;
