import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { useRoles } from "@/hooks/use-roles";
import { ShieldCheck, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const { isAdmin, isManager } = useRoles();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <main className="flex-1 min-w-0">
          <header className="h-14 border-b border-border bg-card flex items-center gap-3 px-4 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-primary" />
              <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/">
                  <Home size={14} />
                  <span className="hidden sm:inline">Accueil</span>
                </Link>
              </Button>
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                {isAdmin ? "Admin" : isManager ? "Manager" : "Staff"}
              </span>
            </div>
          </header>
          <div className="p-4 md:p-6 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
