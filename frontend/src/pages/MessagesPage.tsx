import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConversationList, type ConversationItem } from "@/components/messages/ConversationList";
import { ChatPanel } from "@/components/messages/ChatPanel";
import { MessageCircle, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MessagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  if (!user) return null;

  const showList = isMobile ? !selectedConv : true;
  const showChat = isMobile ? !!selectedConv : true;

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex flex-col min-h-0 container py-2 sm:py-4">
        <div className="flex-1 flex flex-col min-h-0 border border-border rounded-lg overflow-hidden bg-background">
          {/* Title bar */}
          <div className="border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-lg font-bold text-foreground">Messages</h1>
          </div>

          {/* Split view */}
          <div className="flex-1 flex min-h-0">
            {/* Left panel: Conversation list */}
            {showList && (
              <div className={cn(
                "border-r border-border bg-background flex flex-col min-h-0",
                isMobile ? "w-full" : "w-[340px] shrink-0"
              )}>
                <ConversationList
                  selectedId={selectedConv?.id || null}
                  onSelect={(conv) => setSelectedConv(conv)}
                />
              </div>
            )}

            {/* Right panel: Chat */}
            {showChat && (
              <div className={cn(
                "flex-1 flex flex-col min-h-0",
                isMobile ? "w-full" : ""
              )}>
                {selectedConv ? (
                  <ChatPanel
                    conversation={selectedConv}
                    onBack={isMobile ? () => setSelectedConv(null) : undefined}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
                    <MessageCircle size={48} className="mb-3 opacity-20" />
                    <p className="text-sm">Sélectionnez une conversation pour commencer</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
