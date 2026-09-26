import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

/** Shared KYC | KYB tabs — keeps /admin/kyc and /admin/kyb-kyc-v2 both reachable. */
export function AdminIdentityTabs() {
  const { pathname } = useLocation();
  const tabs = [
    { label: "KYC", href: "/admin/kyc" },
    { label: "KYB (v2)", href: "/admin/kyb-kyc-v2" },
  ];
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/60 w-fit mb-4">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            to={t.href}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
