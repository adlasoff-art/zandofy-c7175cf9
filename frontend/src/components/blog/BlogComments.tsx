import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
const sb = supabase as any;
import { useAuth } from "@/contexts/AuthContext";
import { MessageCircle, Send, User, CornerDownRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BlogCommentsProps {
  postId: string;
}

export const BlogComments: React.FC<BlogCommentsProps> = ({ postId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["blog-comments", postId],
    queryFn: async () => {
      const { data } = await sb
        .from("blog_comments")
        .select("*, profiles:user_id(first_name, last_name, avatar_url)")
        .eq("post_id", postId)
        .is("parent_id", null)
        .eq("is_approved", true)
        .order("created_at", { ascending: false });
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  // Fetch replies for all comments
  const { data: replies = [] } = useQuery({
    queryKey: ["blog-replies", postId],
    queryFn: async () => {
      const { data } = await supabase
        .from("blog_comments")
        .select("*, profiles:user_id(first_name, last_name, avatar_url)")
        .eq("post_id", postId)
        .not("parent_id", "is", null)
        .eq("is_approved", true)
        .order("created_at");
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  const addComment = useMutation({
    mutationFn: async ({ text, parentId }: { text: string; parentId?: string }) => {
      const { error } = await supabase.from("blog_comments").insert({
        post_id: postId,
        user_id: user!.id,
        content: text.trim(),
        parent_id: parentId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      setReplyContent("");
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["blog-comments", postId] });
      qc.invalidateQueries({ queryKey: ["blog-replies", postId] });
      toast({ title: "Commentaire publié" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de publier le commentaire", variant: "destructive" }),
  });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

  const getDisplayName = (profile: any) =>
    profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Anonyme" : "Anonyme";

  return (
    <section className="mt-12 pt-8 border-t border-border">
      <h3 className="text-xl font-bold text-foreground flex items-center gap-2 mb-8">
        <MessageCircle size={20} className="text-primary" />
        Commentaires ({comments.length})
      </h3>

      {/* New comment form */}
      {user ? (
        <div className="mb-8">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User size={16} className="text-primary" />
            </div>
            <div className="flex-1">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Partagez votre avis..."
                className="w-full rounded-xl border border-border bg-card p-4 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[80px]"
                rows={3}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => content.trim() && addComment.mutate({ text: content })}
                  disabled={!content.trim() || addComment.isPending}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-foreground text-card rounded-full hover:bg-foreground/90 transition-colors disabled:opacity-40"
                >
                  <Send size={14} /> Publier
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8 p-4 rounded-xl bg-muted/50 text-sm text-muted-foreground text-center">
          <a href="/auth" className="text-primary hover:underline font-medium">Connectez-vous</a> pour laisser un commentaire.
        </div>
      )}

      {/* Comments list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucun commentaire pour l'instant. Soyez le premier !</p>
      ) : (
        <div className="space-y-6">
          {comments.map((comment: any) => {
            const commentReplies = replies.filter((r: any) => r.parent_id === comment.id);
            return (
              <div key={comment.id} className="group">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {comment.profiles?.avatar_url ? (
                      <img src={comment.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={16} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground">{getDisplayName(comment.profiles)}</span>
                      <span className="text-[11px] text-muted-foreground">{formatDate(comment.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{comment.content}</p>
                    {user && (
                      <button
                        onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                        className="mt-2 text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                      >
                        <CornerDownRight size={12} /> Répondre
                      </button>
                    )}

                    {/* Reply form */}
                    {replyTo === comment.id && (
                      <div className="mt-3 flex gap-2">
                        <textarea
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          placeholder="Votre réponse..."
                          className="flex-1 rounded-lg border border-border bg-card p-3 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                          rows={2}
                        />
                        <button
                          onClick={() => replyContent.trim() && addComment.mutate({ text: replyContent, parentId: comment.id })}
                          disabled={!replyContent.trim() || addComment.isPending}
                          className="px-4 py-2 text-xs font-medium bg-foreground text-card rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-40 self-end"
                        >
                          <Send size={12} />
                        </button>
                      </div>
                    )}

                    {/* Replies */}
                    {commentReplies.length > 0 && (
                      <div className="mt-4 space-y-3 pl-4 border-l-2 border-border">
                        {commentReplies.map((reply: any) => (
                          <div key={reply.id} className="flex gap-2">
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                              {reply.profiles?.avatar_url ? (
                                <img src={reply.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <User size={12} className="text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-semibold text-foreground">{getDisplayName(reply.profiles)}</span>
                                <span className="text-[10px] text-muted-foreground">{formatDate(reply.created_at)}</span>
                              </div>
                              <p className="text-xs text-foreground/80">{reply.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
