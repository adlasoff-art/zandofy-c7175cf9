import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/use-roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send, Loader2, MessageCircle, Paperclip, Search, X,
  Check, CheckCheck, ChevronDown, Trash2, ArrowLeft,
} from "lucide-react";
import { QuickReplies } from "./QuickReplies";
import { QuickRepliesManager } from "./QuickRepliesManager";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sanitizeFilename, sanitizeExtension } from "@/utils/sanitize-filename";
import type { ConversationItem } from "./ConversationList";
import { renderChatMessageContent, mergeChatMessages } from "./chatMessageUtils";
import { buildChatMediaRef } from "@/lib/chat-media";

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

const MAX_FILE_SIZE = 3 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

// Patterns for phone numbers and URLs
const PHONE_REGEX = /(\+?\d[\d\s\-().]{6,}\d)/;
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/[^\s]*)?)/i;

interface ChatPanelProps {
  conversation: ConversationItem;
  onBack?: () => void;
}

export function ChatPanel({ conversation, onBack }: ChatPanelProps) {
  const { user } = useAuth();
  const { isAdmin } = useRoles();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mediaEnabled, setMediaEnabled] = useState(false);
  const [linksAllowed, setLinksAllowed] = useState(false);
  const [phoneAllowed, setPhoneAllowed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showQrManager, setShowQrManager] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load store settings
  useEffect(() => {
    async function loadSettings() {
      const { data } = await supabase
        .from("stores")
        .select("chat_media_enabled, chat_links_allowed, chat_phone_allowed")
        .eq("id", conversation.store_id)
        .maybeSingle();
      if (data) {
        setMediaEnabled(data.chat_media_enabled ?? false);
        setLinksAllowed((data as any).chat_links_allowed ?? false);
        setPhoneAllowed((data as any).chat_phone_allowed ?? false);
      }
    }
    loadSettings();
  }, [conversation.store_id]);

  // Load messages
  useEffect(() => {
    if (!conversation.id) return;
    setLoading(true);

    async function load() {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, content, is_read, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });

      if (data) {
        setMessages(data.map(m => ({ ...m, read_at: null })) as ChatMessage[]);
        setTimeout(scrollToBottom, 100);
      }
      setLoading(false);

      // Mark as read
      if (user) {
        await supabase
          .from("messages")
          .update({ is_read: true, read_at: new Date().toISOString() } as any)
          .eq("conversation_id", conversation.id)
          .neq("sender_id", user.id)
          .eq("is_read", false);
      }
    }

    load();

    // Realtime subscription
    const channel = supabase
      .channel(`chat-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setTimeout(scrollToBottom, 100);

          // Auto mark as read if from other party
          if (user && msg.sender_id !== user.id) {
            supabase
              .from("messages")
              .update({ is_read: true, read_at: new Date().toISOString() } as any)
              .eq("id", msg.id);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const deleted = payload.old as { id: string };
          setMessages(prev => prev.filter(m => m.id !== deleted.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, user, scrollToBottom]);

  // Typing indicator via Supabase Presence
  useEffect(() => {
    if (!user || !conversation.id) return;

    const presenceChannel = supabase.channel(`typing-${conversation.id}`, {
      config: { presence: { key: user.id } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const otherTyping = Object.entries(state).some(
          ([key, vals]) => key !== user.id && (vals as any[]).some(v => v.typing)
        );
        setIsTyping(otherTyping);
      })
      .subscribe();

    return () => { supabase.removeChannel(presenceChannel); };
  }, [conversation.id, user]);

  const broadcastTyping = useCallback(() => {
    if (!user || !conversation.id) return;
    const channel = supabase.channel(`typing-${conversation.id}`);
    channel.track({ typing: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      channel.track({ typing: false });
    }, 2000);
  }, [user, conversation.id]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || sending) return;

    const content = newMessage.trim();

    // Check for blocked content (links/phone)
    if (!isAdmin) {
      const hasPhone = PHONE_REGEX.test(content);
      const hasUrl = URL_REGEX.test(content);

      if (hasPhone && !phoneAllowed) {
        toast.error("Vous n'êtes pas autorisé à partager des numéros de téléphone dans cette conversation.");
        return;
      }
      if (hasUrl && !linksAllowed) {
        toast.error("Vous n'êtes pas autorisé à partager des liens dans cette conversation.");
        return;
      }
    }

    setSending(true);
    try {
      const { data, error } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content,
      }).select().single();

      if (error) {
        console.error("Error sending message:", error);
        toast.error("Erreur lors de l'envoi");
      } else if (data) {
        // Optimistic: show immediately
        setMessages(prev => mergeChatMessages(prev, [{ ...data, read_at: null } as ChatMessage]));
        setNewMessage("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        setTimeout(scrollToBottom, 50);
        // Update conversation timestamp
        supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversation.id);
      }
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Format non autorisé. Seuls les images et PDF sont acceptés.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Le fichier ne doit pas dépasser 3 Mo.");
      return;
    }

    setUploading(true);
    try {
      const ext = sanitizeExtension(file.name, "bin");
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-media")
        .upload(filePath, file, { cacheControl: "31536000" });

      if (uploadError) {
        toast.error("Erreur lors de l'upload");
        return;
      }

      const ref = buildChatMediaRef(filePath);
      const isPdf = file.type === "application/pdf";
      const content = isPdf
        ? `[📄 PDF] ${sanitizeFilename(file.name)}\n${ref}`
        : `[📷 Image]\n${ref}`;

      const { data } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content,
      }).select().single();

      if (data) {
        setMessages(prev => mergeChatMessages(prev, [{ ...data, read_at: null } as ChatMessage]));
        setTimeout(scrollToBottom, 50);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (msgId: string) => {
    if (!isAdmin) return;
    const { error } = await supabase.from("messages").delete().eq("id", msgId);
    if (error) toast.error("Erreur lors de la suppression");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Search within conversation
  const searchResults = searchQuery.trim()
    ? messages.filter(m =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const jumpToMessage = (msgId: string) => {
    setHighlightedMsgId(msgId);
    document.getElementById(`msg-${msgId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHighlightedMsgId(null), 2000);
  };

  // Paste image handler
  const handlePaste = async (e: React.ClipboardEvent) => {
    if (!mediaEnabled || !user) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        if (file.size > MAX_FILE_SIZE) {
          toast.error("L'image collée dépasse 3 Mo.");
          return;
        }
        setUploading(true);
        try {
          const ext = file.type.split("/")[1] || "png";
          const filePath = `${user.id}/${Date.now()}-paste.${ext}`;
          const { error: uploadError } = await supabase.storage.from("chat-media").upload(filePath, file, { cacheControl: "31536000" });
          if (uploadError) { toast.error("Erreur lors de l'upload"); return; }
          const ref = buildChatMediaRef(filePath);
          const content = `[📷 Image]\n${ref}`;
          const { data } = await supabase.from("messages").insert({
            conversation_id: conversation.id,
            sender_id: user.id,
            content,
          }).select().single();
          if (data) {
            setMessages(prev => mergeChatMessages(prev, [{ ...data, read_at: null } as ChatMessage]));
            setTimeout(scrollToBottom, 50);
          }
        } finally { setUploading(false); }
        return;
      }
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce<{ date: string; msgs: ChatMessage[] }[]>((acc, msg) => {
    const date = new Date(msg.created_at).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const last = acc[acc.length - 1];
    if (last && last.date === date) {
      last.msgs.push(msg);
    } else {
      acc.push({ date, msgs: [msg] });
    }
    return acc;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header — sticky on mobile */}
      <div className="px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0.75rem))] md:pt-3 border-b border-border flex items-center gap-3 shrink-0 sticky top-0 z-10 bg-background md:static">
        {onBack && (
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground md:hidden">
            <ArrowLeft size={20} />
          </button>
        )}
        {/* Avatar with online indicator */}
        <div className="relative shrink-0">
          {conversation.other_party_avatar ? (
            <img
              src={conversation.other_party_avatar}
              alt=""
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <MessageCircle size={14} className="text-muted-foreground" />
            </div>
          )}
          {!conversation.is_store_owner && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center">
              {conversation.store_is_online && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full border-[1.5px] border-card ${conversation.store_is_online ? "bg-emerald-500" : "bg-amber-500/60"}`} />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {conversation.other_party_name}
          </p>
          {!conversation.is_store_owner && (
            <p className={`text-[10px] font-medium ${conversation.store_is_online ? "text-emerald-600" : "text-amber-600"}`}>
              {conversation.store_is_online ? "En ligne" : "Hors ligne"}
            </p>
          )}
          {conversation.product_name && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {conversation.product_image && (
                <img src={conversation.product_image} alt="" className="w-5 h-5 rounded-sm object-cover border border-border shrink-0" />
              )}
              <p className="text-[11px] text-primary truncate">
                {conversation.product_name}
                {conversation.product_price ? ` · $${conversation.product_price.toFixed(2)}` : ""}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className={cn(
            "p-2 rounded-md transition-colors",
            searchOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Search size={16} />
        </button>
      </div>

      {/* Search in conversation */}
      {searchOpen && (
        <div className="px-4 py-2 border-b border-border bg-muted/30">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans la discussion..."
              className="pl-8 pr-8 h-8 text-xs"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="mt-1 text-[11px] text-muted-foreground">
              {searchResults.length} résultat{searchResults.length !== 1 ? "s" : ""}
              {searchResults.length > 0 && (
                <span className="ml-2">
                  {searchResults.map((m, i) => (
                    <button
                      key={m.id}
                      onClick={() => jumpToMessage(m.id)}
                      className="text-primary hover:underline mx-0.5"
                    >
                      #{i + 1}
                    </button>
                  ))}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <MessageCircle size={40} className="mb-3 opacity-20" />
            <p className="text-sm">Démarrez la conversation</p>
          </div>
        ) : (
          groupedMessages.map(group => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground bg-background px-2">{group.date}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {group.msgs.map((msg, idx) => {
                const isOwn = msg.sender_id === user?.id;
                const time = new Date(msg.created_at).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    className={cn(
                      "flex mb-2 group",
                      isOwn ? "justify-end" : "justify-start",
                      highlightedMsgId === msg.id && "animate-pulse"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] px-3 py-2 rounded-lg text-sm relative",
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-[hsl(var(--chat-received))] text-[hsl(var(--chat-received-foreground))] rounded-bl-sm",
                        highlightedMsgId === msg.id && "ring-2 ring-accent"
                      )}
                    >
                      {renderChatMessageContent(msg.content)}
                      <div className={cn(
                        "flex items-center gap-1 mt-1",
                        isOwn ? "justify-end" : "justify-start"
                      )}>
                        <span className={cn(
                          "text-[10px]",
                          isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
                        )}>
                          {time}
                        </span>
                        {/* Read receipts for own messages */}
                        {isOwn && (
                          msg.is_read ? (
                            <CheckCheck size={12} className="text-primary-foreground/70" />
                          ) : (
                            <Check size={12} className="text-primary-foreground/40" />
                          )
                        )}
                      </div>

                      {/* Admin delete */}
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(msg.id)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full items-center justify-center text-[10px] hidden group-hover:flex"
                          title="Supprimer ce message"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      {isTyping && (
        <div className="px-4 py-1">
          <span className="text-[11px] text-muted-foreground italic animate-pulse">
            {conversation.other_party_name} est en train d'écrire…
          </span>
        </div>
      )}

      {/* Quick replies (vendor only) */}
      {conversation.is_store_owner && !showQrManager && (
        <QuickReplies
          onSelect={(text) => setNewMessage(text)}
          storeId={conversation.store_id}
          onManage={() => setShowQrManager(true)}
        />
      )}

      {/* Quick replies manager */}
      {conversation.is_store_owner && showQrManager && (
        <div className="border-t border-border max-h-[50%] overflow-hidden flex flex-col">
          <QuickRepliesManager storeId={conversation.store_id} onClose={() => setShowQrManager(false)} />
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border px-3 py-2 flex items-center gap-2 shrink-0">
        {/* File upload button — always visible */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          title="Joindre une image ou un PDF (max 3 Mo)"
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
        </button>
        <textarea
          ref={textareaRef}
          value={newMessage}
          onChange={e => { setNewMessage(e.target.value); broadcastTyping(); autoResize(); }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Écrivez votre message..."
          rows={2}
          className="flex-1 resize-none bg-muted/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground min-h-[44px] max-h-[120px]"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!newMessage.trim() || sending}
          className="shrink-0 h-9 w-9"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  );
}
