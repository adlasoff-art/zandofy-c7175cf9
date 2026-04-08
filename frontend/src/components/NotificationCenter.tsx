import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Package, MessageCircle, Tag, Info, Check, CheckCheck, Trash2, X, BellRing, Star, ShieldAlert } from "lucide-react";
import { useNotifications, type Notification } from "@/hooks/use-notifications";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useI18n } from "@/contexts/I18nContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string }> = {
  order: { icon: Package, color: "text-blue-500" },
  message: { icon: MessageCircle, color: "text-primary" },
  promo: { icon: Tag, color: "text-orange-500" },
  points: { icon: Star, color: "text-yellow-500" },
  moderation: { icon: ShieldAlert, color: "text-orange-500" },
  info: { icon: Info, color: "text-muted-foreground" },
};

function NotificationItem({
  notif,
  onRead,
  onDelete,
  onNavigate,
}: {
  notif: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (link: string) => void;
}) {
  const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
  const Icon = config.icon;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer border-b border-border last:border-0 ${
        !notif.is_read ? "bg-primary/5" : ""
      }`}
      onClick={() => {
        if (!notif.is_read) onRead(notif.id);
        if (notif.link) onNavigate(notif.link);
      }}
    >
      <div className={`mt-0.5 shrink-0 ${config.color}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${!notif.is_read ? "font-semibold text-foreground" : "text-foreground"}`}>
          {notif.title}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notif.message}</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: fr })}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notif.id);
        }}
        className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function PushToggle() {
  const { supported, isSubscribed, loading, subscribe, unsubscribe, permission } = usePushNotifications();
  const { locale } = useI18n();

  if (!supported) return null;

  const denied = permission === "denied";
  const label = isSubscribed
    ? locale === "fr" ? "Notifications push activées" : "Push notifications enabled"
    : locale === "fr" ? "Activer les notifications push" : "Enable push notifications";
  const deniedLabel = locale === "fr" ? "Notifications bloquées par le navigateur" : "Notifications blocked by browser";

  return (
    <div className="px-4 py-2 border-b border-border">
      <button
        disabled={loading || denied}
        onClick={() => (isSubscribed ? unsubscribe() : subscribe())}
        className={`flex items-center gap-2 w-full text-xs py-1.5 rounded transition-colors ${
          denied
            ? "text-muted-foreground cursor-not-allowed"
            : isSubscribed
            ? "text-primary hover:text-primary/80"
            : "text-foreground hover:text-primary"
        }`}
      >
        <BellRing size={14} className={isSubscribed ? "text-primary" : ""} />
        <span className="flex-1 text-left">{denied ? deniedLabel : label}</span>
        <span
          className={`w-8 h-4 rounded-full relative transition-colors ${
            isSubscribed ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-0.5 w-3 h-3 rounded-full bg-card shadow transition-transform ${
              isSubscribed ? "left-4" : "left-0.5"
            }`}
          />
        </span>
      </button>
    </div>
  );
}

export function NotificationCenter({ trigger }: { trigger?: React.ReactNode }) {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t, locale } = useI18n();

  const handleNavigate = (link: string) => {
    setOpen(false);
    navigate(link);
  };

  const defaultTrigger = (
    <button className="relative p-2 text-foreground hover:text-primary transition-colors" aria-label="Notifications">
      <Bell size={20} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-sale text-sale-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || defaultTrigger}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-0 max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-bold text-foreground">{t("notif.title")}</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={markAllAsRead}>
              <CheckCheck size={12} className="mr-1" /> {t("notif.markAllRead")}
            </Button>
          )}
        </div>
        <PushToggle />
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-8">{t("notif.loading")}</p>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell size={32} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">{t("notif.empty")}</p>
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notif={n}
                onRead={markAsRead}
                onDelete={deleteNotification}
                onNavigate={handleNavigate}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
