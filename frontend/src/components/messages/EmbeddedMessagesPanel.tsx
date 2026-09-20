import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConversationList, type ConversationItem } from "@/components/messages/ConversationList";
import { ChatPanel } from "@/components/messages/ChatPanel";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Messages UI embedded inside dashboard (sidebar + KPIs stay visible).
 * Mobile: list OR chat; desktop: split list + chat.
 */
export function EmbeddedMessagesPanel({ className }: { className?: string }) {
  const isMobile = useIsMobile();
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);

  const showList = isMobile ? !selectedConv : true;
  const showChat = isMobile ? !!selectedConv : true;

  return (
    <div
      className={cn(
        "border border-border rounded-lg overflow-hidden bg-card flex flex-col",
        "min-h-[480px] h-[min(70vh,720px)]",
        className
      )}
    >
      <div className="border-b border-border px-4 py-2.5 shrink-0">
        <h2 className="text-sm font-bold text-foreground">Messages</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Échanges avec boutiques et commandes
        </p>
      </div>

      <div className="flex-1 flex min-h-0">
        {showList && (
          <div
            className={cn(
              "border-r border-border bg-background flex flex-col min-h-0",
              isMobile ? "w-full" : "w-[300px] xl:w-[340px] shrink-0"
            )}
          >
            <ConversationList
              selectedId={selectedConv?.id || null}
              onSelect={(conv) => setSelectedConv(conv)}
            />
          </div>
        )}

        {showChat && (
          <div className={cn("flex-1 flex flex-col min-h-0", isMobile ? "w-full" : "")}>
            {selectedConv ? (
              <ChatPanel
                conversation={selectedConv}
                onBack={isMobile ? () => setSelectedConv(null) : undefined}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-6">
                <MessageCircle size={40} className="mb-3 opacity-20" />
                <p className="text-sm">Sélectionnez une conversation pour commencer</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
