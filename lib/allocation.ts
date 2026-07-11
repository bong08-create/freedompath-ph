/**
 * Allocation & Blended Rate — lib/allocation.ts
 *
 * Deterministic, rule-based default % split across Emergency Fund/HYSA,
 * Pag-IBIG MP2, and a UITF risk tier, keyed by risk profile (spec.md §2.5).
 * This is what /api/plan uses today, and doubles as the safe fallback the
 * AI-generated allocation (a later task) must fall back to if its response
 * fails the "sums to 100" / "only cites rates.json" guardrails.
 *
 * The blended expected annual return rate used by lib/goalCalc.ts is derived
 * here as the allocation-weighted average of the actual rates.json entries —
 * never invented, always traceable back to that file (CLAUDE.md hard rule #2).
 */
import type { RiskProfile } from "./riskClassifier";
import ratesData from "../data/rates.json";

export interface AllocationPercentages {
  emergencyFundHysa: number;
  pagibigMp2: number;
  uitf: number;
}

export const DEFAULT_ALLOCATION_BY_RISK_PROFILE: Record<RiskProfile, AllocationPercentages> = {
  conservative: { emergencyFundHysa: 50, pagibigMp2: 35, uitf: 15 },
  moderate: { emergencyFundHysa: 30, pagibigMp2: 35, uitf: 35 },
  aggressive: { emergencyFundHysa: 15, pagibigMp2: 25, uitf: 60 },
};

const UITF_VEHICLE_ID_BY_RISK_PROFILE: Record<RiskProfile, string> = {
  conservative: "uitf_conservative",
  moderate: "uitf_moderate",
  aggressive: "uitf_aggressive",
};

// Category-level fund-type labels only (e.g. "Balanced Fund") — never a
// specific bank/proprietary product name, per PRD.md §4 out-of-scope rule.
export const UITF_TIER_LABEL_BY_RISK_PROFILE: Record<RiskProfile, string> = {
  conservative: "Money Market/Bond Fund",
  moderate: "Balanced Fund",
  aggressive: "Equity Fund",
};

export function getUitfTierLabel(riskProfile: RiskProfile): string {
  return UITF_TIER_LABEL_BY_RISK_PROFILE[riskProfile];
}

interface RateVehicle {
  id: string;
  rate_pct: number;
  [key: string]: unknown;
}

function getRatePct(vehicleId: string): number {
  const vehicle = (ratesData.vehicles as RateVehicle[]).find((v) => v.id === vehicleId);
  if (!vehicle) {
    throw new Error(`Rate vehicle "${vehicleId}" not found in data/rates.json`);
  }
  return vehicle.rate_pct;
}

export function getDefaultAllocation(riskProfile: RiskProfile): AllocationPercentages {
  return DEFAULT_ALLOCATION_BY_RISK_PROFILE[riskProfile];
}

/** The actual rates.json figures relevant to a given risk profile — HYSA, MP2, and the matching UITF tier. */
export function getRatesForRiskProfile(
  riskProfile: RiskProfile
): { hysaRate: number; mp2Rate: number; uitfRate: number } {
  return {
    hysaRate: getRatePct("hysa"),
    mp2Rate: getRatePct("mp2"),
    uitfRate: getRatePct(UITF_VEHICLE_ID_BY_RISK_PROFILE[riskProfile]),
  };
}

/**
 * Weighted-average blended annual return (as a decimal, e.g. 0.0429 for
 * 4.29%), using the given risk profile's default allocation weights against
 * the actual rates.json figures for HYSA, MP2, and the matching UITF tier.
 */
export function getBlendedAnnualReturnRate(riskProfile: RiskProfile): number {
  const allocation = getDefaultAllocation(riskProfile);
  const { hysaRate, mp2Rate, uitfRate } = getRatesForRiskProfile(riskProfile);

  const blendedPct =
    (allocation.emergencyFundHysa / 100) * hysaRate +
    (allocation.pagibigMp2 / 100) * mp2Rate +
    (allocation.uitf / 100) * uitfRate;

  return blendedPct / 100;
}

export function allocationSumsTo100(allocation: AllocationPercentages): boolean {
  const sum = allocation.emergencyFundHysa + allocation.pagibigMp2 + allocation.uitf;
  return Math.abs(sum - 100) < 1e-9;
}
