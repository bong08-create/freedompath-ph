import { describe, expect, it } from "vitest";
import {
  allocationSumsTo100,
  DEFAULT_ALLOCATION_BY_RISK_PROFILE,
  getBlendedAnnualReturnRate,
  getDefaultAllocation,
} from "../lib/allocation";
import { RISK_PROFILES } from "../lib/riskClassifier";

describe("allocation percentages", () => {
  it("sum to exactly 100 for every risk profile", () => {
    for (const riskProfile of RISK_PROFILES) {
      const allocation = getDefaultAllocation(riskProfile);
      expect(allocationSumsTo100(allocation)).toBe(true);
      expect(
        allocation.emergencyFundHysa + allocation.pagibigMp2 + allocation.uitf
      ).toBe(100);
    }
  });

  it("detects an allocation that does NOT sum to 100", () => {
    expect(
      allocationSumsTo100({ emergencyFundHysa: 50, pagibigMp2: 30, uitf: 15 })
    ).toBe(false);
  });

  it("every configured risk profile has a default allocation defined", () => {
    for (const riskProfile of RISK_PROFILES) {
      expect(DEFAULT_ALLOCATION_BY_RISK_PROFILE[riskProfile]).toBeDefined();
    }
  });
});

describe("getBlendedAnnualReturnRate", () => {
  it("returns a higher blended rate for more aggressive risk profiles, grounded in data/rates.json", () => {
    const conservative = getBlendedAnnualReturnRate("conservative");
    const moderate = getBlendedAnnualReturnRate("moderate");
    const aggressive = getBlendedAnnualReturnRate("aggressive");

    expect(conservative).toBeGreaterThan(0);
    expect(moderate).toBeGreaterThan(conservative);
    expect(aggressive).toBeGreaterThan(moderate);
  });

  it("matches the hand-computed weighted average for the conservative tier", () => {
    // 50% x 2.30 (hysa) + 35% x 7.12 (mp2) + 15% x 4.33 (uitf_conservative) = 4.2915%
    expect(getBlendedAnnualReturnRate("conservative")).toBeCloseTo(0.042915, 5);
  });
});
