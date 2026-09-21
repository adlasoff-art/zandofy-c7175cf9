import { describe, expect, it } from "vitest";
import { toggleGuestWishlistId } from "@/lib/guest-wishlist";

describe("guest-wishlist", () => {
  it("toggles product ids", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const added = toggleGuestWishlistId([], id);
    expect(added).toEqual([id]);
    expect(toggleGuestWishlistId(added, id)).toEqual([]);
  });

  it("rejects non-uuid", () => {
    expect(toggleGuestWishlistId([], "not-a-uuid")).toEqual([]);
  });
});
