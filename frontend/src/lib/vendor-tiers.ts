/**
 * Vendor tier configuration and limits
 */

export const VENDOR_TIERS = {
  beginner: {
    label: "Beginner",
    maxProducts: 10,
    features: ["Catalogue limité (10 produits)", "Statistiques basiques"],
    color: "text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground",
  },
  pro: {
    label: "Pro",
    maxProducts: 100,
    features: ["Catalogue étendu (100 produits)", "Analytics avancés", "Support prioritaire"],
    color: "text-blue-500",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  grand_supplier: {
    label: "Grand Supplier",
    maxProducts: Infinity,
    features: ["Catalogue illimité", "Analytics avancés", "Support VIP", "Badge vérifié"],
    color: "text-amber-500",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
} as const;

export type VendorTier = keyof typeof VENDOR_TIERS;

export const PUBLISH_STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  draft: { label: "Brouillon", badgeClass: "bg-muted text-muted-foreground" },
  pending_approval: { label: "En attente", badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  published: { label: "Publié", badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  rejected: { label: "Refusé", badgeClass: "bg-destructive/10 text-destructive" },
};
