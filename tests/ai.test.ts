import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyRisk, generateRecommendation } from "../lib/ai";
import { allocationSumsTo100 } from "../lib/allocation";
import { RISK_PROFILES } from "../lib/riskClassifier";
import type { RiskAnswers } from "../lib/schemas";
import { calculateSSSPension } from "../lib/sss";
import { calculateRequiredMonthlySavings } from "../lib/goalCalc";

// These tests intentionally never call the real OpenAI API — they verify the
// REQUIRED fallback path (spec.md: "fall back to a deterministic rule-based
// classifier if the AI response doesn't parse") by forcing the "no API key"
// branch, which is deterministic and safe to run in CI with no network.
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const sampleAnswers: RiskAnswers = {
  marketDropReaction: "hold",
  investmentHorizon: "7_to_15_years",
  primaryGoal: "balanced_growth",
  investingExperience: "some_uitf_or_stocks",
  volatilityComfort: "comfortable",
};

describe("classifyRisk (AI integration, fallback path)", () => {
  it("always returns one of the three valid enum values, even without an API key", async () => {
    const result = await classifyRisk(sampleAnswers);
    expect(RISK_PROFILES).toContain(result.riskProfile);
    expect(result.explanation).toBeTruthy();
  });

  it("reports its source as rule_based_fallback when no API key is configured", async () => {
    const result = await classifyRisk(sampleAnswers);
    expect(result.source).toBe("rule_based_fallback");
  });
});

describe("generateRecommendation (AI integration, template fallback path)", () => {
  const sss = calculateSSSPension({ monthlySalary: 30000, creditedYearsOfService: 15 });
  const goalCalc = calculateRequiredMonthlySavings({
    currentAge: 30,
    targetRetirementAge: 60,
    currentSavings: 100000,
    currentMonthlySavingsRate: 5000,
    annualReturnRate: 0.05,
    target: { type: "corpus", targetRetirementCorpus: 8000000 },
  });

  it("falls back to the template response without an API key, with allocation summing to 100", async () => {
    const result = await generateRecommendation({
      age: 30,
      riskProfile: "moderate",
      riskExplanation: "test",
      sss,
      goalCalc,
    });

    expect(result.source).toBe("template_fallback");
    expect(allocationSumsTo100(result.allocation)).toBe(true);
    expect(result.levers.length).toBeGreaterThanOrEqual(2);
  });

  it("restates the exact required-savings figure in the fallback narrative (never a different number)", async () => {
    const result = await generateRecommendation({
      age: 30,
      riskProfile: "moderate",
      riskExplanation: "test",
      sss,
      goalCalc,
    });

    const roundedRequired = Math.round(goalCalc.requiredMonthlyContribution).toLocaleString("en-PH");
    expect(result.narrative).toContain(roundedRequired);
  });
});
