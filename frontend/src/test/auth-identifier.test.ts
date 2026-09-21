import { describe, expect, it } from "vitest";
import {
  normalizePhoneE164,
  parseAuthIdentifier,
  phoneToSyntheticEmail,
  isSyntheticAuthEmail,
} from "@/lib/auth-helpers";

describe("parseAuthIdentifier", () => {
  it("parses email", () => {
    const r = parseAuthIdentifier("  Jean@Mail.COM ");
    expect(r).toEqual({ kind: "email", email: "jean@mail.com" });
  });

  it("parses local CD phone", () => {
    const r = parseAuthIdentifier("0812345678");
    expect(r.kind).toBe("phone");
    if (r.kind === "phone") {
      expect(r.e164).toBe("+243812345678");
      expect(r.syntheticEmail).toBe("243812345678@users.zandofy.internal");
    }
  });

  it("rejects synthetic domain as input", () => {
    expect(parseAuthIdentifier("x@users.zandofy.internal").kind).toBe("invalid");
  });

  it("helpers", () => {
    expect(normalizePhoneE164("+243 81 234 5678")).toBe("+243812345678");
    expect(phoneToSyntheticEmail("+243812345678")).toBe("243812345678@users.zandofy.internal");
    expect(isSyntheticAuthEmail("243812345678@users.zandofy.internal")).toBe(true);
  });
});
