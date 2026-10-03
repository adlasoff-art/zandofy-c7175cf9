/**
 * Stable commercial SEO pillar URLs (blog hubs).
 * Keep in sync with docs/SEO_CONTENT_PILLARS_RDC.md and CMS publish slugs.
 */
export type SeoImportGuide = {
  slug: string;
  path: string;
  labelFr: string;
  labelEn: string;
};

export const SEO_IMPORT_GUIDES: SeoImportGuide[] = [
  {
    slug: "achat-en-chine-livre-rdc-kinshasa",
    path: "/blog/achat-en-chine-livre-rdc-kinshasa",
    labelFr: "Acheter en Chine livré en RDC",
    labelEn: "Buy from China, delivered to DRC",
  },
  {
    slug: "import-export-congo-marketplace",
    path: "/blog/import-export-congo-marketplace",
    labelFr: "Import-export Congo",
    labelEn: "Congo import-export",
  },
  {
    slug: "fournisseur-fiable-chine-afrique",
    path: "/blog/fournisseur-fiable-chine-afrique",
    labelFr: "Fournisseur fiable Chine → Afrique",
    labelEn: "Reliable China → Africa supplier",
  },
  {
    slug: "achat-turquie-livraison-afrique",
    path: "/blog/achat-turquie-livraison-afrique",
    labelFr: "Achat Turquie livré en Afrique",
    labelEn: "Buy from Turkey to Africa",
  },
  {
    slug: "marketplace-sino-africaine-zandofy",
    path: "/blog/marketplace-sino-africaine-zandofy",
    labelFr: "Marketplace sino-africaine",
    labelEn: "Sino-African marketplace",
  },
];
