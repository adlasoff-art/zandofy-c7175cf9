import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Send, Loader2, MessageCircle, LogIn, FileText, Paperclip } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { renderChatMessageContent, mergeChatMessages } from "@/components/messages/chatMessageUtils";

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface InternalChatProps {
  storeId: string;
  storeName: string;
  productId?: string;
  productName?: string;
  productImage?: string;
  productPrice?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

export function InternalChat({ storeId, storeName, productId, productName, productImage, productPrice }: InternalChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mediaEnabled, setMediaEnabled] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastFetchRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, []);

  // Check if store has media enabled
  useEffect(() => {
    async function checkMedia() {
      const { data } = await supabase
        .from("stores")
        .select("chat_media_enabled")
        .eq("id", storeId)
        .maybeSingle();
      if (data) setMediaEnabled(data.chat_media_enabled ?? false);
    }
    checkMedia();
  }, [storeId]);

  // Load or create conversation
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function initConversation() {
      setLoading(true);
      let query = supabase
        .from("conversations")
        .select("id")
        .eq("user_id", user!.id)
        .eq("store_id", storeId);

      if (productId) {
        query = query.eq("product_id", productId);
      } else {
        query = query.is("product_id", null);
      }

      const { data: existing } = await query.maybeSingle();
      if (existing) {
        setConversationId(existing.id);
      }
      setLoading(false);
    }

    initConversation();
  }, [user, storeId, productId]);

  // Load messages when conversation exists + fast polling
  useEffect(() => {
    if (!conversationId) return;

    async function loadMessages() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        setMessages(data as ChatMessage[]);
        lastFetchRef.current = data[data.length - 1].created_at;
        setTimeout(scrollToBottom, 100);
      }
    }

    loadMessages();

    // Fast incremental polling (1.2s when tab focused)
    let active = true;
    const poll = async () => {
      if (!active || document.hidden) return;
      const since = lastFetchRef.current;
      let query = supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });

      if (since) {
        query = query.gt("created_at", since);
      }

      const { data } = await query;
      if (data && data.length > 0) {
        lastFetchRef.current = data[data.length - 1].created_at;
        setMessages(prev => mergeChatMessages(prev, data as ChatMessage[]));
        setTimeout(scrollToBottom, 100);
      }
    };

    const interval = setInterval(poll, 1200);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [conversationId, scrollToBottom]);

  const ensureConversation = async (): Promise<string | null> => {
    if (conversationId) return conversationId;
    if (!user) return null;

    const insertData: any = { user_id: user.id, store_id: storeId };
    if (productId) insertData.product_id = productId;

    const { data: conv, error } = await supabase
      .from("conversations")
      .insert(insertData)
      .select("id")
      .single();

    if (error || !conv) {
      console.error("Error creating conversation:", error);
      return null;
    }
    setConversationId(conv.id);
    return conv.id;
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !user || sending) return;
    const content = newMessage.trim();
    setSending(true);

    try {
      const convId = await ensureConversation();
      if (!convId) { setSending(false); return; }

      const { data, error } = await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: user.id,
        content,
      }).select().single();

      if (error) {
        console.error("Error sending message:", error);
      } else if (data) {
        // Optimistic: show immediately
        setMessages(prev => mergeChatMessages(prev, [data as ChatMessage]));
        lastFetchRef.current = data.created_at;
        setNewMessage("");
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
        setTimeout(scrollToBottom, 50);
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
      toast.error("Format non autorisé. Seuls les images (JPG, PNG, WebP, GIF) et les PDF sont acceptés.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Le fichier ne doit pas dépasser 5 Mo.");
      return;
    }

    setUploading(true);
    try {
      const convId = await ensureConversation();
      if (!convId) { setUploading(false); return; }

      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-media")
        .upload(filePath, file);

      if (uploadError) {
        toast.error("Erreur lors de l'upload");
        console.error(uploadError);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(filePath);
      const isPdf = file.type === "application/pdf";
      const content = isPdf
        ? `[📄 PDF] ${file.name}\n${urlData.publicUrl}`
        : `[📷 Image]\n${urlData.publicUrl}`;

      const { data } = await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: user.id,
        content,
      }).select().single();

      if (data) {
        setMessages(prev => mergeChatMessages(prev, [data as ChatMessage]));
        lastFetchRef.current = data.created_at;
        setTimeout(scrollToBottom, 50);
      }
    } finally {
      setUploading(false);
    }
  };

  // Handle paste for images
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
          toast.error("L'image collée dépasse 5 Mo.");
          return;
        }

        setUploading(true);
        try {
          const convId = await ensureConversation();
          if (!convId) { setUploading(false); return; }

          const ext = file.type.split("/")[1] || "png";
          const filePath = `${user.id}/${Date.now()}-paste.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("chat-media")
            .upload(filePath, file);

          if (uploadError) {
            toast.error("Erreur lors de l'upload de l'image");
            return;
          }

          const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(filePath);
          const content = `[📷 Image]\n${urlData.publicUrl}`;

          const { data } = await supabase.from("messages").insert({
            conversation_id: convId,
            sender_id: user.id,
            content,
          }).select().single();

          if (data) {
            setMessages(prev => mergeChatMessages(prev, [data as ChatMessage]));
            lastFetchRef.current = data.created_at;
            setTimeout(scrollToBottom, 50);
          }
        } finally {
          setUploading(false);
        }
        return; // only handle first image
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Not logged in state
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8 space-y-4">
        <LogIn size={40} className="text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          Connectez-vous pour envoyer un message à <strong>{storeName}</strong>.
        </p>
        <Link to="/auth">
          <Button size="sm" className="gap-1.5">
            <LogIn size={14} /> Se connecter
          </Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Product context banner */}
      {productName && (
        <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center gap-2.5">
          {productImage && (
            <img src={productImage} alt={productName} className="w-10 h-10 rounded-md object-cover border border-border shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground truncate">{productName}</p>
            {productPrice && (
              <p className="text-[11px] font-semibold text-primary">{productPrice}</p>
            )}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 min-h-[300px] max-h-[60vh]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
            <MessageCircle size={40} className="mb-3 opacity-20" />
            <p className="text-sm">Démarrez la conversation avec <strong>{storeName}</strong>.</p>
            <p className="text-xs mt-1">Votre message sera envoyé directement au fournisseur.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === user.id;
            return (
              <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                    isOwn
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-[hsl(var(--chat-received))] text-[hsl(var(--chat-received-foreground))] rounded-bl-none"
                  }`}
                >
                  {renderChatMessageContent(msg.content)}
                  <span
                    className={`block text-[10px] mt-1 ${
                      isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border px-3 py-2 flex items-end gap-2">
        {/* File upload button (only if media enabled) */}
        {mediaEnabled && (
          <>
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
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 mb-0.5"
              title="Envoyer une image ou un PDF (max 5 Mo)"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
            </button>
          </>
        )}
        <textarea
          ref={textareaRef}
          value={newMessage}
          onChange={(e) => { setNewMessage(e.target.value); autoResize(); }}
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
          className="shrink-0 h-9 w-9 mb-0.5"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  );
}
