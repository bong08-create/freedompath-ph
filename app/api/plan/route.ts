import { NextRequest, NextResponse } from "next/server";
import { intakeFormSchema } from "@/lib/schemas";
import { calculateSSSPension } from "@/lib/sss";
import { calculateRequiredMonthlySavings } from "@/lib/goalCalc";
import { classifyRiskRuleBased } from "@/lib/riskClassifier";
import {
  getBlendedAnnualReturnRate,
  getDefaultAllocation,
  getUitfTierLabel,
} from "@/lib/allocation";

/**
 * POST /api/plan
 *
 * Server-side re-validates the intake form (never trusts client-only
 * validation — CLAUDE.md hard rule #6), then runs the deterministic
 * calculation pipeline described in Architecture_Notes.md §1/§3:
 *
 *   validate -> classify risk -> lib/sss.ts -> lib/goalCalc.ts -> allocation
 *
 * NOTE: risk classification currently uses the rule-based classifier
 * directly. The OpenAI risk-classification + narrative-generation calls are
 * a separate, upcoming piece of work (they will call OpenAI first and fall
 * back to this exact same `classifyRiskRuleBased` function and allocation
 * defaults if the AI response doesn't parse or fails a guardrail check) —
 * nothing here needs to change when that lands.
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

  const riskClassification = classifyRiskRuleBased(input.riskAnswers);
  const allocation = getDefaultAllocation(riskClassification.riskProfile);
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

  return NextResponse.json({
    riskProfile: riskClassification.riskProfile,
    riskExplanation: riskClassification.explanation,
    sss: sssResult,
    goalCalc: goalCalcResult,
    allocation,
    uitfTierLabel: getUitfTierLabel(riskClassification.riskProfile),
    blendedAnnualReturnRatePct: Math.round(annualReturnRate * 10000) / 100,
  });
}
