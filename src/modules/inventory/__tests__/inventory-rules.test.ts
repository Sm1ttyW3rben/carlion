/**
 * Inventory Business Rules — Unit Tests
 *
 * Tests:
 * - Status transition matrix (spec: MOD_02 Section 12.1)
 * - Role-based price visibility (spec: MOD_02 Section 12.6)
 * - Publish rules (spec: MOD_02 Section 12.2)
 */

import { describe, it, expect } from "vitest";
import {
  STATUS_TRANSITIONS,
  PUBLISHABLE_STATUSES,
  PRICE_VISIBILITY_ROLES,
} from "../domain/constants";
import { vinSchema } from "../domain/validators";
import type { VehicleStatus } from "../domain/types";

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

describe("Status transitions", () => {
  it("draft → in_preparation is allowed", () => {
    expect(STATUS_TRANSITIONS["draft"]).toContain("in_preparation");
  });

  it("draft → available is allowed", () => {
    expect(STATUS_TRANSITIONS["draft"]).toContain("available");
  });

  it("draft → reserved is NOT allowed", () => {
    expect(STATUS_TRANSITIONS["draft"]).not.toContain("reserved");
  });

  it("draft → sold is NOT allowed", () => {
    expect(STATUS_TRANSITIONS["draft"]).not.toContain("sold");
  });

  it("available → reserved is allowed", () => {
    expect(STATUS_TRANSITIONS["available"]).toContain("reserved");
  });

  it("available → sold is allowed", () => {
    expect(STATUS_TRANSITIONS["available"]).toContain("sold");
  });

  it("available → delivered is NOT allowed (must go via sold)", () => {
    expect(STATUS_TRANSITIONS["available"]).not.toContain("delivered");
  });

  it("reserved → available is allowed (reservation released)", () => {
    expect(STATUS_TRANSITIONS["reserved"]).toContain("available");
  });

  it("reserved → sold is allowed", () => {
    expect(STATUS_TRANSITIONS["reserved"]).toContain("sold");
  });

  it("sold → delivered is allowed", () => {
    expect(STATUS_TRANSITIONS["sold"]).toContain("delivered");
  });

  it("sold → available is NOT allowed", () => {
    expect(STATUS_TRANSITIONS["sold"]).not.toContain("available");
  });

  it("delivered → archived is allowed", () => {
    expect(STATUS_TRANSITIONS["delivered"]).toContain("archived");
  });

  it("delivered → available is NOT allowed", () => {
    expect(STATUS_TRANSITIONS["delivered"]).not.toContain("available");
  });

  it("archived → draft is allowed (restore)", () => {
    expect(STATUS_TRANSITIONS["archived"]).toContain("draft");
  });

  it("archived → available is NOT allowed (must go via draft first)", () => {
    expect(STATUS_TRANSITIONS["archived"]).not.toContain("available");
  });

  it("all statuses have defined transitions", () => {
    const allStatuses: VehicleStatus[] = [
      "draft", "in_preparation", "available", "reserved", "sold", "delivered", "archived",
    ];
    for (const status of allStatuses) {
      expect(STATUS_TRANSITIONS[status]).toBeDefined();
      expect(Array.isArray(STATUS_TRANSITIONS[status])).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Publish rules
// ---------------------------------------------------------------------------

describe("Publishable statuses", () => {
  it("available is publishable", () => {
    expect(PUBLISHABLE_STATUSES).toContain("available");
  });

  it("reserved is publishable", () => {
    expect(PUBLISHABLE_STATUSES).toContain("reserved");
  });

  it("draft is NOT publishable", () => {
    expect(PUBLISHABLE_STATUSES).not.toContain("draft");
  });

  it("sold is NOT publishable", () => {
    expect(PUBLISHABLE_STATUSES).not.toContain("sold");
  });

  it("delivered is NOT publishable", () => {
    expect(PUBLISHABLE_STATUSES).not.toContain("delivered");
  });

  it("archived is NOT publishable", () => {
    expect(PUBLISHABLE_STATUSES).not.toContain("archived");
  });

  it("in_preparation is NOT publishable", () => {
    expect(PUBLISHABLE_STATUSES).not.toContain("in_preparation");
  });
});

// ---------------------------------------------------------------------------
// Price visibility
// ---------------------------------------------------------------------------

describe("Price visibility roles", () => {
  it("owner can see prices", () => {
    expect(PRICE_VISIBILITY_ROLES).toContain("owner");
  });

  it("admin can see prices", () => {
    expect(PRICE_VISIBILITY_ROLES).toContain("admin");
  });

  it("manager can see prices", () => {
    expect(PRICE_VISIBILITY_ROLES).toContain("manager");
  });

  it("salesperson CANNOT see purchase prices", () => {
    expect(PRICE_VISIBILITY_ROLES).not.toContain("salesperson");
  });

  it("receptionist CANNOT see purchase prices", () => {
    expect(PRICE_VISIBILITY_ROLES).not.toContain("receptionist");
  });

  it("viewer CANNOT see purchase prices", () => {
    expect(PRICE_VISIBILITY_ROLES).not.toContain("viewer");
  });
});

// ---------------------------------------------------------------------------
// Margin calculation
// ---------------------------------------------------------------------------

describe("Margin calculation", () => {
  function calculateMargin(
    askingPriceGross: string | null,
    purchasePriceNet: string | null,
    taxType: "margin" | "regular"
  ): string | null {
    if (!askingPriceGross || !purchasePriceNet) return null;
    const asking = parseFloat(askingPriceGross);
    const purchase = parseFloat(purchasePriceNet);
    if (isNaN(asking) || isNaN(purchase)) return null;
    const net = taxType === "regular" ? asking / 1.19 : asking;
    return (net - purchase).toFixed(2);
  }

  it("Differenzbesteuerung: margin = asking - purchase", () => {
    const margin = calculateMargin("15000", "10000", "margin");
    expect(margin).toBe("5000.00");
  });

  it("Regelbesteuerung: margin = (asking / 1.19) - purchase", () => {
    const margin = calculateMargin("11900", "5000", "regular");
    // 11900 / 1.19 = 10000, 10000 - 5000 = 5000
    expect(parseFloat(margin!)).toBeCloseTo(5000, 0);
  });

  it("returns null if asking price is missing", () => {
    expect(calculateMargin(null, "10000", "margin")).toBeNull();
  });

  it("returns null if purchase price is missing", () => {
    expect(calculateMargin("15000", null, "margin")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// VIN validation (via validator schema)
// ---------------------------------------------------------------------------

describe("VIN validation", () => {
  it("accepts a valid 17-character VIN", () => {
    const result = vinSchema.safeParse("WBA3A5G59ENP26705");
    expect(result.success).toBe(true);
  });

  it("rejects a VIN shorter than 17 characters", () => {
    const result = vinSchema.safeParse("WBA3A5G59ENP267");
    expect(result.success).toBe(false);
  });

  it("rejects a VIN longer than 17 characters", () => {
    const result = vinSchema.safeParse("WBA3A5G59ENP267051");
    expect(result.success).toBe(false);
  });

  it("rejects VIN with invalid characters (I, O, Q are not allowed)", () => {
    // I is not valid in VIN
    const result = vinSchema.safeParse("IBAX5G59ENP267051");
    expect(result.success).toBe(false);
  });
});
