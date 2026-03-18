import React, { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Image, Menu, FileText, LayoutDashboard, Palette, MapPin, FootprintsIcon, Languages, Scale, BookOpen, Briefcase,
} from "lucide-react";
import { HeroBannerEditor } from "@/components/admin/HeroBannerEditor";
import { ColorPaletteEditor } from "@/components/admin/ColorPaletteEditor";
import { PositionableBannersEditor } from "@/components/admin/PositionableBannersEditor";

// Lazy-load existing tabs to keep file manageable
import { lazy, Suspense } from "react";

const MenusTab = lazy(() => import("@/components/admin/cms/MenusTab"));
const PagesTab = lazy(() => import("@/components/admin/cms/PagesTab"));
const SectionsTab = lazy(() => import("@/components/admin/cms/SectionsTab"));
const FooterTab = lazy(() => import("@/components/admin/cms/FooterTab"));
const TextsTab = lazy(() => import("@/components/admin/cms/TextsTab"));
const LegalPagesTab = lazy(() => import("@/components/admin/cms/LegalPagesTab"));
const BlogTab = lazy(() => import("@/components/admin/cms/BlogTab"));

type Tab = "hero" | "banners" | "menus" | "pages" | "sections" | "colors" | "footer" | "texts" | "legal" | "blog";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "hero", label: "Hero Banner", icon: Image },
  { key: "banners", label: "Bannières", icon: MapPin },
  { key: "menus", label: "Menus", icon: Menu },
  { key: "pages", label: "Pages", icon: FileText },
  { key: "sections", label: "Sections", icon: LayoutDashboard },
  { key: "colors", label: "Thème & Couleurs", icon: Palette },
  { key: "texts", label: "Textes i18n", icon: Languages },
  { key: "legal", label: "FAQ & Légal", icon: Scale },
  { key: "blog", label: "Blog", icon: BookOpen },
  { key: "footer", label: "Footer", icon: FootprintsIcon },
];

const FallbackLoader = () => (
  <div className="flex justify-center py-8">
    <div className="animate-spin text-primary w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
  </div>
);

const AdminCMSPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>("hero");

  return (
    <AdminLayout title="Bannières & CMS">
      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full border transition-colors whitespace-nowrap ${
              tab === t.key
                ? "bg-foreground text-card border-foreground"
                : "bg-card text-foreground border-border hover:border-foreground"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "hero" && <HeroBannerEditor />}
      {tab === "banners" && <PositionableBannersEditor />}
      {tab === "colors" && <ColorPaletteEditor />}
      <Suspense fallback={<FallbackLoader />}>
        {tab === "menus" && <MenusTab />}
        {tab === "pages" && <PagesTab />}
        {tab === "sections" && <SectionsTab />}
        {tab === "footer" && <FooterTab />}
        {tab === "texts" && <TextsTab />}
        {tab === "legal" && <LegalPagesTab />}
        {tab === "blog" && <BlogTab />}
      </Suspense>
    </AdminLayout>
  );
};

export default AdminCMSPage;
