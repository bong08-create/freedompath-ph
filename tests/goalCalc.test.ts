import { describe, expect, it } from "vitest";
import { calculateRequiredMonthlySavings } from "../lib/goalCalc";

describe("calculateRequiredMonthlySavings", () => {
  it("matches a standard annuity/retirement-calculator worked example with compounding (0% edge case verified separately below)", () => {
    // 30-year-old targeting a ₱10,000,000 corpus by 60 (360 months), ₱100,000
    // current savings, 6% annual return compounded monthly.
    // Verified independently against the standard FV-of-lump-sum and
    // FV-of-ordinary-annuity formulas:
    //   FV(current savings) = 100,000 x (1.005)^360 ≈ 602,257.52
    //   required payment = remaining x r / ((1+r)^360 - 1) ≈ 9,355.50
    const result = calculateRequiredMonthlySavings({
      currentAge: 30,
      targetRetirementAge: 60,
      currentSavings: 100000,
      currentMonthlySavingsRate: 12000,
      annualReturnRate: 0.06,
      target: { type: "corpus", targetRetirementCorpus: 10000000 },
    });

    expect(result.monthsToRetirement).toBe(360);
    expect(result.futureValueOfCurrentSavings).toBeCloseTo(602257.52, 1);
    expect(result.requiredMonthlyContribution).toBeCloseTo(9355.5, 1);
    // Current rate (12,000) exceeds required (~9,355.50) -> ahead of pace
    expect(result.status).toBe("ahead");
    expect(result.gapPerMonth).toBeCloseTo(2644.5, 1);
  });

  it("matches a simple 0%-return worked example exactly (no compounding, hand-verifiable)", () => {
    // With a 0% return assumption, required monthly payment is just a
    // straight-line division: ₱1,200,000 target / 120 months = ₱10,000/month exactly.
    const result = calculateRequiredMonthlySavings({
      currentAge: 25,
      targetRetirementAge: 35,
      currentSavings: 0,
      currentMonthlySavingsRate: 5000,
      annualReturnRate: 0,
      target: { type: "corpus", targetRetirementCorpus: 1200000 },
    });

    expect(result.requiredMonthlyContribution).toBe(10000);
    expect(result.status).toBe("behind");
    expect(result.gapPerMonth).toBe(5000);
  });

  it("reports a behind-pace status with the correct ₱ gap for an under-saver", () => {
    const result = calculateRequiredMonthlySavings({
      currentAge: 25,
      targetRetirementAge: 65,
      currentSavings: 0,
      currentMonthlySavingsRate: 5000,
      annualReturnRate: 0.07,
      target: { type: "corpus", targetRetirementCorpus: 20000000 },
    });

    expect(result.requiredMonthlyContribution).toBeCloseTo(7619.59, 1);
    expect(result.status).toBe("behind");
    expect(result.gapPerMonth).toBeCloseTo(2619.59, 1);
  });

  it("never returns a negative required-monthly-savings figure, even when already far ahead", () => {
    const result = calculateRequiredMonthlySavings({
      currentAge: 40,
      targetRetirementAge: 65,
      currentSavings: 2000000,
      currentMonthlySavingsRate: 20000,
      annualReturnRate: 0.05,
      target: { type: "corpus", targetRetirementCorpus: 8000000 },
    });

    expect(result.requiredMonthlyContribution).toBeGreaterThanOrEqual(0);
    expect(result.status).toBe("ahead");
    expect(result.gapPerMonth).toBeCloseTo(18257.93, 1);
  });

  it("derives the target corpus from a desired retirement income + SSS pension + withdrawal rate, surfacing the assumption", () => {
    // Monthly income gap = 50,000 - 10,000 = 40,000/mo -> 480,000/yr
    // Corpus at a 4% withdrawal rate = 480,000 / 0.04 = 12,000,000
    const result = calculateRequiredMonthlySavings({
      currentAge: 30,
      targetRetirementAge: 60,
      currentSavings: 0,
      currentMonthlySavingsRate: 0,
      annualReturnRate: 0.05,
      target: {
        type: "income",
        desiredMonthlyRetirementIncome: 50000,
        sssMonthlyPension: 10000,
      },
    });

    expect(result.targetRetirementCorpus).toBe(12000000);
    expect(result.assumptions.withdrawalRate).toBe(0.04);
  });

  it("validates that targetRetirementAge must be greater than currentAge", () => {
    expect(() =>
      calculateRequiredMonthlySavings({
        currentAge: 60,
        targetRetirementAge: 60,
        currentSavings: 0,
        currentMonthlySavingsRate: 0,
        annualReturnRate: 0.05,
        target: { type: "corpus", targetRetirementCorpus: 1000000 },
      })
    ).toThrow();
  });
});
