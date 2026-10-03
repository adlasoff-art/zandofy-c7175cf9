/**
 * Category tree helpers (N-level parent_id chains).
 * Used by admin categorization, catalogue filters, vendor labels, and nav.
 */
import { expandInterestCategoryIds } from "@/lib/discovery-engine";

export type CategoryTreeNode = {
  id: string;
  name?: string | null;
  name_fr?: string | null;
  parent_id?: string | null;
  sort_order?: number | null;
};

export type CategoryOption = {
  id: string;
  name_fr: string;
  name: string;
  parent_id: string | null;
  depth: number;
  /** Indented short label for native <select> */
  label: string;
  /** Full breadcrumb path */
  pathLabel: string;
};

export { expandInterestCategoryIds };

function displayName(c: CategoryTreeNode, preferFr = true): string {
  if (preferFr) return (c.name_fr || c.name || "").trim() || c.id;
  return (c.name || c.name_fr || "").trim() || c.id;
}

function compareNodes(a: CategoryTreeNode, b: CategoryTreeNode): number {
  const ao = a.sort_order ?? 0;
  const bo = b.sort_order ?? 0;
  if (ao !== bo) return ao - bo;
  return displayName(a).localeCompare(displayName(b), "fr", { sensitivity: "base" });
}

export function buildChildrenMap(
  categories: CategoryTreeNode[],
): Map<string | null, CategoryTreeNode[]> {
  const map = new Map<string | null, CategoryTreeNode[]>();
  for (const c of categories) {
    const p = c.parent_id ?? null;
    if (!map.has(p)) map.set(p, []);
    map.get(p)!.push(c);
  }
  for (const [, kids] of map) {
    kids.sort(compareNodes);
  }
  return map;
}

export function getCategoryPath(
  id: string,
  categories: CategoryTreeNode[],
): CategoryTreeNode[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const path: CategoryTreeNode[] = [];
  let cur: CategoryTreeNode | undefined = byId.get(id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return path;
}

export function formatCategoryPath(
  id: string,
  categories: CategoryTreeNode[],
  separator = " › ",
): string {
  return getCategoryPath(id, categories)
    .map((c) => displayName(c))
    .filter(Boolean)
    .join(separator);
}

function pushOption(
  out: CategoryOption[],
  node: CategoryTreeNode,
  categories: CategoryTreeNode[],
  depth: number,
) {
  const pathLabel = formatCategoryPath(node.id, categories);
  const nameFr = displayName(node);
  const indent = "\u00a0\u00a0".repeat(depth);
  out.push({
    id: node.id,
    name_fr: nameFr,
    name: (node.name || nameFr).trim(),
    parent_id: node.parent_id ?? null,
    depth,
    label: `${indent}${nameFr}`,
    pathLabel,
  });
}

/** DFS flatten for selects — depth-indented label + full path. Cycle-safe; includes orphans. */
export function flattenCategoryOptions(
  categories: CategoryTreeNode[],
): CategoryOption[] {
  const children = buildChildrenMap(categories);
  const out: CategoryOption[] = [];
  const seen = new Set<string>();

  const walk = (parentId: string | null, depth: number) => {
    for (const node of children.get(parentId) || []) {
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      pushOption(out, node, categories, depth);
      walk(node.id, depth + 1);
    }
  };

  walk(null, 0);

  // Broken parent_id chains (parent missing) — still selectable for admin/vendor
  const orphans = categories.filter((c) => !seen.has(c.id)).sort(compareNodes);
  for (const node of orphans) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    pushOption(out, node, categories, 0);
    walk(node.id, 1);
  }

  return out;
}

/** Nodes that have at least one child (useful as filter roots). */
export function categoriesWithChildren(
  categories: CategoryTreeNode[],
): CategoryTreeNode[] {
  const parents = new Set<string>();
  for (const c of categories) {
    if (c.parent_id) parents.add(c.parent_id);
  }
  return categories.filter((c) => parents.has(c.id)).sort(compareNodes);
}

/** Expand a category id to itself + all descendants (N levels). */
export function expandCategoryIds(
  rootIds: string[],
  categories: CategoryTreeNode[],
): string[] {
  return expandInterestCategoryIds(
    rootIds,
    categories.map((c) => ({ id: c.id, parent_id: c.parent_id ?? null })),
  );
}
