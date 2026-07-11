import { describe, expect, it } from "vitest";
import {
  classifyRiskRuleBased,
  isValidRiskProfile,
  RISK_PROFILES,
} from "../lib/riskClassifier";
import type { RiskAnswers } from "../lib/schemas";

const conservativeAnswers: RiskAnswers = {
  marketDropReaction: "sell_everything",
  investmentHorizon: "under_3_years",
  primaryGoal: "capital_preservation",
  investingExperience: "none",
  volatilityComfort: "not_comfortable",
};

const moderateAnswers: RiskAnswers = {
  marketDropReaction: "sell_some",
  investmentHorizon: "3_to_7_years",
  primaryGoal: "balanced_growth",
  investingExperience: "some_uitf_or_stocks",
  volatilityComfort: "comfortable",
};

const aggressiveAnswers: RiskAnswers = {
  marketDropReaction: "buy_more",
  investmentHorizon: "15_plus_years",
  primaryGoal: "maximize_growth",
  investingExperience: "active_investor",
  volatilityComfort: "very_comfortable",
};

describe("classifyRiskRuleBased", () => {
  it("always returns one of the three valid enum values, never empty/undefined", () => {
    for (const answers of [conservativeAnswers, moderateAnswers, aggressiveAnswers]) {
      const result = classifyRiskRuleBased(answers);
      expect(RISK_PROFILES).toContain(result.riskProfile);
      expect(result.explanation).toBeTruthy();
    }
  });

  it("classifies all-conservative answers as conservative", () => {
    expect(classifyRiskRuleBased(conservativeAnswers).riskProfile).toBe("conservative");
  });

  it("classifies all-moderate answers as moderate", () => {
    expect(classifyRiskRuleBased(moderateAnswers).riskProfile).toBe("moderate");
  });

  it("classifies all-aggressive answers as aggressive", () => {
    expect(classifyRiskRuleBased(aggressiveAnswers).riskProfile).toBe("aggressive");
  });

  it("produces a consistent classification for the same inputs (deterministic, no AI variance)", () => {
    const first = classifyRiskRuleBased(moderateAnswers);
    const second = classifyRiskRuleBased(moderateAnswers);
    expect(first).toEqual(second);
  });
});

describe("isValidRiskProfile (fallback-path guard)", () => {
  it("accepts the three valid enum values", () => {
    expect(isValidRiskProfile("conservative")).toBe(true);
    expect(isValidRiskProfile("moderate")).toBe(true);
    expect(isValidRiskProfile("aggressive")).toBe(true);
  });

  it("rejects a malformed/unparseable AI response, which is what triggers the rule-based fallback", () => {
    expect(isValidRiskProfile("very risky")).toBe(false);
    expect(isValidRiskProfile(undefined)).toBe(false);
    expect(isValidRiskProfile(null)).toBe(false);
    expect(isValidRiskProfile(42)).toBe(false);
    expect(isValidRiskProfile("")).toBe(false);
  });

  it("falls back to classifyRiskRuleBased whenever the AI response doesn't parse", () => {
    // Simulates the guardrail flow described in Architecture_Notes.md §2.3:
    // an unparseable AI response must never break the flow.
    const malformedAiResponse: unknown = "not-a-real-enum-value";
    const riskProfile = isValidRiskProfile(malformedAiResponse)
      ? malformedAiResponse
      : classifyRiskRuleBased(moderateAnswers).riskProfile;

    expect(RISK_PROFILES).toContain(riskProfile);
  });
});
