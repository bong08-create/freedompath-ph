import { NextRequest, NextResponse } from "next/server";
import { intakeFormSchema } from "@/lib/schemas";
import { calculateSSSPension } from "@/lib/sss";
import { calculateRequiredMonthlySavings } from "@/lib/goalCalc";
import { getBlendedAnnualReturnRate } from "@/lib/allocation";
import { classifyRisk, generateRecommendation } from "@/lib/ai";
import ratesData from "@/data/rates.json";

/**
 * POST /api/plan
 *
 * Server-side re-validates the intake form (never trusts client-only
 * validation — CLAUDE.md hard rule #6), then runs the full pipeline
 * described in Architecture_Notes.md §1/§3:
 *
 *   validate -> classify risk (AI, rule-based fallback) -> lib/sss.ts ->
 *   lib/goalCalc.ts -> generate narrative + allocation (AI, template
 *   fallback, guardrailed against the numbers just computed) -> respond
 *
 * lib/ai.ts owns every AI call and guardrail; this route never talks to
 * OpenAI directly and never lets an AI response override a deterministic
 * figure.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = intakeFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;

  const riskClassification = await classifyRisk(input.riskAnswers);
  const annualReturnRate = getBlendedAnnualReturnRate(riskClassification.riskProfile);

  const sssResult = calculateSSSPension({
    monthlySalary: input.monthlyIncome,
    creditedYearsOfService: input.creditedYearsOfService,
    memberType: input.memberType,
  });

  const totalCurrentSavings =
    input.currentSavings.emergencyFund + input.currentSavings.mp2 + input.currentSavings.uitf;

  const goalTarget =
    input.goal.type === "amount"
      ? ({ type: "corpus", targetRetirementCorpus: input.goal.targetAmount } as const)
      : ({
          type: "income",
          desiredMonthlyRetirementIncome: input.goal.desiredMonthlyRetirementIncome,
          sssMonthlyPension: sssResult.estimatedMonthlyPension,
        } as const);

  const goalCalcResult = calculateRequiredMonthlySavings({
    currentAge: input.age,
    targetRetirementAge: input.targetRetirementAge,
    currentSavings: totalCurrentSavings,
    currentMonthlySavingsRate: input.currentMonthlySavingsRate,
    annualReturnRate,
    target: goalTarget,
  });

  const recommendation = await generateRecommendation({
    age: input.age,
    riskProfile: riskClassification.riskProfile,
    riskExplanation: riskClassification.explanation,
    sss: sssResult,
    goalCalc: goalCalcResult,
  });

  const relevantVehicleIds = ["hysa", "mp2", `uitf_${riskClassification.riskProfile}`];
  const sources = ratesData.vehicles
    .filter((v) => relevantVehicleIds.includes(v.id))
    .map((v) => ({ name: v.name, rate_pct: v.rate_pct, source: v.source, as_of: v.as_of }));

  return NextResponse.json({
    riskProfile: riskClassification.riskProfile,
    riskExplanation: riskClassification.explanation,
    riskProfileSource: riskClassification.source,
    sss: sssResult,
    goalCalc: goalCalcResult,
    allocation: recommendation.allocation,
    uitfTierLabel: recommendation.uitfTierLabel,
    narrative: recommendation.narrative,
    levers: recommendation.levers,
    recommendationSource: recommendation.source,
    blendedAnnualReturnRatePct: Math.round(annualReturnRate * 10000) / 100,
    sources,
    ratesLastReviewed: ratesData.last_reviewed,
  });
}
