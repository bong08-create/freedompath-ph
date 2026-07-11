/**
 * Required Monthly Savings Calculation — lib/goalCalc.ts
 *
 * Deterministic time-value-of-money calculation answering "how much do I
 * need to save monthly to hit my target by retirement age." Pure function,
 * no AI involved.
 *
 * Per CLAUDE.md hard rule #4, this must never be delegated to the AI layer —
 * the AI's job is only to narrate this function's output (§2.5 of spec.md),
 * never to recompute or restate a different number. A server-side guardrail
 * elsewhere must reject any AI response whose stated figures don't match
 * this function's output exactly.
 */

export type SavingsStatus = "ahead" | "on-track" | "behind";

export interface GoalCalcInput {
  currentAge: number;
  targetRetirementAge: number;
  /** Sum of current savings across all categories (EF/HYSA + MP2 + UITF/other), ₱. */
  currentSavings: number;
  /** What the user currently saves per month, ₱ — compared against the required figure. */
  currentMonthlySavingsRate: number;
  /**
   * Blended expected annual return (e.g. 0.05 for 5%), derived elsewhere from
   * the risk profile mapped to data/rates.json. This function just takes the
   * already-resolved number — it does not read rates.json itself.
   */
  annualReturnRate: number;
  /**
   * Either give a direct ₱ target corpus, or give a desired monthly
   * retirement income (plus the SSS pension estimate + withdrawal rate) and
   * let this function derive the corpus itself via a 4%-rule-style
   * withdrawal-rate assumption (spec.md §2.4 step 1).
   */
  target:
    | { type: "corpus"; targetRetirementCorpus: number }
    | {
        type: "income";
        desiredMonthlyRetirementIncome: number;
        sssMonthlyPension: number;
        /** Annual withdrawal rate assumption, default 0.04 (the "4% rule"). */
        withdrawalRate?: number;
      };
}

export interface GoalCalcResult {
  yearsToRetirement: number;
  monthsToRetirement: number;
  targetRetirementCorpus: number;
  futureValueOfCurrentSavings: number;
  /** Required level monthly contribution to close the gap. Never negative. */
  requiredMonthlyContribution: number;
  /** Projected corpus at the user's current stated monthly savings rate. */
  projectedCorpusAtCurrentRate: number;
  status: SavingsStatus;
  /**
   * ₱/month: if behind, how much more is needed on top of the current rate;
   * if ahead, the current monthly surplus. Always >= 0 — direction is
   * carried by `status`, never by a negative number.
   */
  gapPerMonth: number;
  /** All assumptions used, surfaced so the UI never hides why the number is what it is. */
  assumptions: {
    annualReturnRate: number;
    withdrawalRate: number | null;
  };
}

const DEFAULT_WITHDRAWAL_RATE = 0.04;
const STATUS_TOLERANCE = 1; // ₱1/month tolerance to call it "on-track"

export function calculateRequiredMonthlySavings(input: GoalCalcInput): GoalCalcResult {
  const {
    currentAge,
    targetRetirementAge,
    currentSavings,
    currentMonthlySavingsRate,
    annualReturnRate,
    target,
  } = input;

  if (targetRetirementAge <= currentAge) {
    throw new Error("targetRetirementAge must be greater than currentAge");
  }
  if (currentSavings < 0 || currentMonthlySavingsRate < 0) {
    throw new Error("currentSavings and currentMonthlySavingsRate must be >= 0");
  }
  if (annualReturnRate < 0) {
    throw new Error("annualReturnRate must be >= 0");
  }

  const monthsToRetirement = Math.round((targetRetirementAge - currentAge) * 12);
  const yearsToRetirement = monthsToRetirement / 12;
  const monthlyRate = annualReturnRate / 12;

  let targetRetirementCorpus: number;
  let withdrawalRate: number | null = null;

  if (target.type === "corpus") {
    targetRetirementCorpus = target.targetRetirementCorpus;
  } else {
    withdrawalRate = target.withdrawalRate ?? DEFAULT_WITHDRAWAL_RATE;
    const monthlyIncomeGap = Math.max(
      target.desiredMonthlyRetirementIncome - target.sssMonthlyPension,
      0
    );
    const annualIncomeGap = monthlyIncomeGap * 12;
    targetRetirementCorpus = annualIncomeGap / withdrawalRate;
  }

  const futureValueOfCurrentSavings = futureValueLumpSum(
    currentSavings,
    monthlyRate,
    monthsToRetirement
  );

  const remainingNeeded = Math.max(targetRetirementCorpus - futureValueOfCurrentSavings, 0);

  const requiredMonthlyContribution = solveAnnuityPayment(
    remainingNeeded,
    monthlyRate,
    monthsToRetirement
  );

  const projectedCorpusAtCurrentRate =
    futureValueOfCurrentSavings +
    futureValueAnnuity(currentMonthlySavingsRate, monthlyRate, monthsToRetirement);

  const surplus = currentMonthlySavingsRate - requiredMonthlyContribution;

  let status: SavingsStatus;
  let gapPerMonth: number;
  if (Math.abs(surplus) <= STATUS_TOLERANCE) {
    status = "on-track";
    gapPerMonth = 0;
  } else if (surplus > 0) {
    status = "ahead";
    gapPerMonth = round2(surplus);
  } else {
    status = "behind";
    gapPerMonth = round2(-surplus);
  }

  return {
    yearsToRetirement: round2(yearsToRetirement),
    monthsToRetirement,
    targetRetirementCorpus: round2(targetRetirementCorpus),
    futureValueOfCurrentSavings: round2(futureValueOfCurrentSavings),
    requiredMonthlyContribution: round2(requiredMonthlyContribution),
    projectedCorpusAtCurrentRate: round2(projectedCorpusAtCurrentRate),
    status,
    gapPerMonth,
    assumptions: {
      annualReturnRate,
      withdrawalRate,
    },
  };
}

/** Future value of a lump sum, compounded monthly. */
function futureValueLumpSum(presentValue: number, monthlyRate: number, months: number): number {
  return presentValue * Math.pow(1 + monthlyRate, months);
}

/** Future value of an ordinary annuity (level payments at the end of each month). */
function futureValueAnnuity(payment: number, monthlyRate: number, months: number): number {
  if (months <= 0) return 0;
  if (monthlyRate === 0) return payment * months;
  return payment * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

/** Solve the ordinary annuity FV formula for the required level monthly payment. */
function solveAnnuityPayment(
  futureValueNeeded: number,
  monthlyRate: number,
  months: number
): number {
  if (futureValueNeeded <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return futureValueNeeded / months;
  return futureValueNeeded * (monthlyRate / (Math.pow(1 + monthlyRate, months) - 1));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
