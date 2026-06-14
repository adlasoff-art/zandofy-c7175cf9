import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useI18n } from "@/contexts/I18nContext";

interface MobileBackButtonProps {
  fallbackTo?: string;
  label?: string;
  className?: string;
}

function canGoBackInApp(): boolean {
  if (typeof window === "undefined") return false;
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  if (typeof idx === "number" && idx > 0) return true;
  return window.history.length > 1;
}

export function MobileBackButton({
  fallbackTo = "/",
  label,
  className = "",
}: MobileBackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const text = label ?? t("general.back") ?? "Retour";

  const handleBack = () => {
    if (canGoBackInApp() && location.key !== "default") {
      navigate(-1);
      return;
    }
    navigate(fallbackTo, { replace: false });
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={text}
      className={`inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] px-1 -ml-1 text-sm font-medium text-foreground hover:text-primary transition-colors touch-manipulation ${className}`}
    >
      <ArrowLeft size={20} className="shrink-0" />
      <span>{text}</span>
    </button>
  );
}
