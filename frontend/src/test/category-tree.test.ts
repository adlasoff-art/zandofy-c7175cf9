import { describe, expect, it } from "vitest";
import {
  categoriesWithChildren,
  expandCategoryIds,
  flattenCategoryOptions,
  formatCategoryPath,
  getCategoryPath,
} from "@/lib/category-tree";

const TREE = [
  { id: "root", name: "Apparel", name_fr: "Prêt-à-porter", parent_id: null, sort_order: 1 },
  { id: "women", name: "Women", name_fr: "Vêtements Femme", parent_id: "root", sort_order: 1 },
  { id: "skirts", name: "Skirts", name_fr: "Jupes", parent_id: "women", sort_order: 2 },
  { id: "blazers", name: "Blazers", name_fr: "Blazers", parent_id: "women", sort_order: 1 },
  { id: "other", name: "Other", name_fr: "Autres", parent_id: null, sort_order: 2 },
];

describe("category-tree", () => {
  it("builds path root › mid › leaf", () => {
    const path = getCategoryPath("skirts", TREE);
    expect(path.map((c) => c.id)).toEqual(["root", "women", "skirts"]);
    expect(formatCategoryPath("skirts", TREE)).toBe(
      "Prêt-à-porter › Vêtements Femme › Jupes",
    );
  });

  it("flattens DFS with depth and sort_order", () => {
    const opts = flattenCategoryOptions(TREE);
    expect(opts.map((o) => o.id)).toEqual([
      "root",
      "women",
      "blazers",
      "skirts",
      "other",
    ]);
    expect(opts.find((o) => o.id === "blazers")?.depth).toBe(2);
    expect(opts.find((o) => o.id === "blazers")?.label.startsWith("\u00a0\u00a0")).toBe(true);
  });

  it("expands descendants N levels", () => {
    const ids = expandCategoryIds(["women"], TREE);
    expect(ids.sort()).toEqual(["blazers", "skirts", "women"].sort());
    expect(expandCategoryIds(["root"], TREE).sort()).toEqual(
      ["root", "women", "blazers", "skirts"].sort(),
    );
  });

  it("lists nodes that have children", () => {
    const withKids = categoriesWithChildren(TREE).map((c) => c.id);
    expect(withKids).toContain("root");
    expect(withKids).toContain("women");
    expect(withKids).not.toContain("skirts");
  });

  it("survives parent cycles without hanging", () => {
    const cyclic = [
      { id: "a", name_fr: "A", parent_id: "b", sort_order: 1 },
      { id: "b", name_fr: "B", parent_id: "a", sort_order: 1 },
    ];
    const opts = flattenCategoryOptions(cyclic);
    expect(opts.map((o) => o.id).sort()).toEqual(["a", "b"]);
  });

  it("includes orphan nodes with missing parent", () => {
    const withOrphan = [
      ...TREE,
      { id: "orphan", name_fr: "Orphelin", parent_id: "missing", sort_order: 1 },
    ];
    const opts = flattenCategoryOptions(withOrphan);
    expect(opts.some((o) => o.id === "orphan")).toBe(true);
  });
});
