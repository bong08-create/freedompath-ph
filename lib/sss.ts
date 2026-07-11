/**
 * SSS Retirement Pension Estimate — lib/sss.ts
 *
 * Deterministic implementation of the RA 11199 (Social Security Act of 2018)
 * §12 monthly pension formula. This is a pure function: same inputs always
 * produce the same output, with no AI involved.
 *
 * Per CLAUDE.md hard rule #4, this calculation must never be delegated to
 * the AI layer — the AI's job is only to narrate this function's output,
 * never to recompute or restate a different number.
 *
 * IMPORTANT — this is a simplified educational estimate, not an official SSS
 * computation. The real SSS formula uses a full contribution history
 * (Average Monthly Salary Credit over the highest 60 of the last 120 monthly
 * contributions, rounded to official MSC brackets). This estimator
 * approximates AMSC directly from the user's self-reported current monthly
 * salary/income, clamped to the current MSC floor/ceiling. Flag this
 * distinction in the UI (see spec.md §2.3 acceptance criteria).
 */

export type SSSMemberType = "employed" | "self-employed" | "voluntary" | "ofw";

export interface SSSPensionInput {
  /** Current monthly salary/income, ₱. Used as a proxy for AMSC. */
  monthlySalary: number;
  /** Credited Years of Service — total years of SSS contributions. */
  creditedYearsOfService: number;
  /**
   * Member type. Per PRD.md's resolved open question, the RA 11199 §12
   * pension formula applies uniformly across member types — only
   * contribution mechanics differ. Accepted here for UI/context display only;
   * it does not change the calculation.
   */
  memberType?: SSSMemberType;
}

export interface SSSPensionResult {
  /**
   * Members need at least 120 monthly contributions (~10 credited years)
   * before the semester of retirement to qualify for a monthly pension at
   * all. Below that, SSS pays a lump sum instead (out of scope here).
   */
  eligibleForMonthlyPension: boolean;
  /** Average Monthly Salary Credit used in the calculation, ₱ (after floor/ceiling clamp). */
  averageMonthlySalaryCredit: number;
  /** The three RA 11199 formula variants, ₱/month, before the ₱1,000 supplement. */
  formulaBreakdown: {
    /** 300 + 20%(AMSC) + 2%(AMSC) x (CYS - 10) */
    salaryCreditFormula: number;
    /** 40% x AMSC */
    salaryReplacementFormula: number;
    /** ₱1,200 if CYS >= 10, ₱2,400 if CYS >= 20, else 0 (not yet eligible) */
    minimumPensionFloor: number;
  };
  /** The highest of the three variants above, before the ₱1,000 supplement. */
  basePension: number;
  /** Flat ₱1,000 across-the-board supplemental amount added to all pensions since 2017. */
  supplementalAmount: number;
  /** basePension + supplementalAmount — the final estimated monthly pension. */
  estimatedMonthlyPension: number;
  /**
   * Informational note: SSS pays a 13th month pension every December, on top
   * of the 12 monthly payments above. Not included in estimatedMonthlyPension.
   */
  thirteenthMonthPensionNote: string;
}

// Current Monthly Salary Credit floor and ceiling (SSS contribution schedule,
// fully phased in as of 2025). Update this file if SSS revises the MSC table.
const MIN_MSC = 4000;
const MAX_MSC = 30000;

const MINIMUM_YEARS_TO_QUALIFY = 10; // 120 monthly contributions
const MINIMUM_PENSION_10_YEARS = 1200;
const MINIMUM_PENSION_20_YEARS = 2400;
const MONTHLY_SUPPLEMENT = 1000;

export function calculateSSSPension(input: SSSPensionInput): SSSPensionResult {
  const { monthlySalary, creditedYearsOfService } = input;

  if (monthlySalary < 0) {
    throw new Error("monthlySalary must be >= 0");
  }
  if (creditedYearsOfService < 0) {
    throw new Error("creditedYearsOfService must be >= 0");
  }

  const amsc = clamp(monthlySalary, MIN_MSC, MAX_MSC);
  const cys = creditedYearsOfService;
  const eligibleForMonthlyPension = cys >= MINIMUM_YEARS_TO_QUALIFY;

  const salaryCreditFormula =
    300 + 0.2 * amsc + 0.02 * amsc * Math.max(cys - MINIMUM_YEARS_TO_QUALIFY, 0);
  const salaryReplacementFormula = 0.4 * amsc;
  const minimumPensionFloor = !eligibleForMonthlyPension
    ? 0
    : cys >= 20
      ? MINIMUM_PENSION_20_YEARS
      : MINIMUM_PENSION_10_YEARS;

  const basePension = eligibleForMonthlyPension
    ? Math.max(salaryCreditFormula, salaryReplacementFormula, minimumPensionFloor)
    : 0;

  const supplementalAmount = eligibleForMonthlyPension ? MONTHLY_SUPPLEMENT : 0;
  const estimatedMonthlyPension = basePension + supplementalAmount;

  return {
    eligibleForMonthlyPension,
    averageMonthlySalaryCredit: amsc,
    formulaBreakdown: {
      salaryCreditFormula: round2(salaryCreditFormula),
      salaryReplacementFormula: round2(salaryReplacementFormula),
      minimumPensionFloor,
    },
    basePension: round2(basePension),
    supplementalAmount,
    estimatedMonthlyPension: round2(estimatedMonthlyPension),
    thirteenthMonthPensionNote: eligibleForMonthlyPension
      ? "SSS also pays a 13th month pension every December, in addition to the 12 monthly payments shown here."
      : "Not eligible for a monthly pension with fewer than 10 credited years of service (120 contributions) — SSS provides a lump-sum benefit instead.",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
