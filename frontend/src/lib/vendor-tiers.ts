/**
 * Vendor tier configuration and limits
 */

export const VENDOR_TIERS = {
  beginner: {
    label: "Beginner",
    maxProducts: 10,
    maxCollaborators: 2,
    maxPromos: 3,
    features: ["Catalogue limité (10 produits)", "Statistiques basiques"],
    color: "text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground",
  },
  intermediate: {
    label: "Intermediate",
    maxProducts: 50,
    maxCollaborators: 2,
    maxPromos: 10,
    features: ["Catalogue étendu (50 produits)", "Statistiques basiques", "Coupons"],
    color: "text-emerald-500",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  pro: {
    label: "Pro",
    maxProducts: 100,
    maxCollaborators: 3,
    maxPromos: 25,
    features: ["Catalogue étendu (100 produits)", "Analytics avancés", "Support prioritaire"],
    color: "text-blue-500",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  grand_supplier: {
    label: "Grand Supplier",
    maxProducts: 1000,
    maxCollaborators: 5,
    maxPromos: 50,
    features: ["Catalogue large (1000 produits)", "Analytics avancés", "Support VIP", "Badge vérifié"],
    color: "text-amber-500",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  factory: {
    label: "Factory",
    maxProducts: 1999,
    maxCollaborators: 10,
    maxPromos: 100,
    features: ["Catalogue illimité (1999 produits)", "Analytics premium", "Support dédié", "Badge vérifié", "API access"],
    color: "text-purple-500",
    badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
} as const;

export type VendorTier = keyof typeof VENDOR_TIERS;

/** Maps service_packages slug → vendor tier */
export const PACKAGE_TIER_MAP: Record<string, VendorTier> = {
  standard: "beginner",
  pro: "intermediate",
  premium: "pro",
  enterprise: "grand_supplier",
};

export const PUBLISH_STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  draft: { label: "Brouillon", badgeClass: "bg-muted text-muted-foreground" },
  pending_approval: { label: "En attente", badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  published: { label: "Publié", badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  rejected: { label: "Refusé", badgeClass: "bg-destructive/10 text-destructive" },
  revision_requested: { label: "Révision demandée", badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

export const MODERATION_REJECTION_REASONS = [
  { id: "incomplete_info", label: "Informations incomplètes", description: "Titre, description ou spécifications manquantes" },
  { id: "poor_images", label: "Photos de mauvaise qualité", description: "Images floues, trop petites ou non conformes" },
  { id: "misleading_content", label: "Contenu trompeur", description: "Description ou photos ne correspondant pas au produit" },
  { id: "prohibited_product", label: "Produit interdit", description: "Produit non autorisé sur la plateforme" },
  { id: "pricing_issue", label: "Prix incorrect ou suspect", description: "Prix anormalement bas ou élevé" },
  { id: "duplicate", label: "Produit en doublon", description: "Ce produit existe déjà dans le catalogue" },
  { id: "category_mismatch", label: "Mauvaise catégorie", description: "Le produit est dans la mauvaise catégorie" },
  { id: "ip_violation", label: "Violation de propriété intellectuelle", description: "Marque, logo ou design protégé utilisé sans autorisation" },
  { id: "other", label: "Autre raison", description: "Raison personnalisée" },
] as const;

export type ModerationReasonId = typeof MODERATION_REJECTION_REASONS[number]["id"];
