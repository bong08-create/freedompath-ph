/**
 * Shared zod validation schemas — lib/schemas.ts
 *
 * Per CLAUDE.md hard rule #6, every form input needs a schema used on BOTH
 * the client component (immediate feedback) and the API route handler
 * (never trust client-only validation). Import this file from both places —
 * never redefine these rules separately.
 */
import { z } from "zod";

export const memberTypeSchema = z.enum([
  "employed",
  "self-employed",
  "voluntary",
  "ofw",
]);
export type MemberType = z.infer<typeof memberTypeSchema>;

// --- Risk behavior questions (§2.1 of spec.md) ---------------------------
// Each question's options are ordered from most conservative (index 0) to
// most aggressive (index 3) — lib/riskClassifier.ts scores on that ordering.
export const riskQuestionOptions = {
  marketDropReaction: [
    "sell_everything",
    "sell_some",
    "hold",
    "buy_more",
  ] as const,
  investmentHorizon: [
    "under_3_years",
    "3_to_7_years",
    "7_to_15_years",
    "15_plus_years",
  ] as const,
  primaryGoal: [
    "capital_preservation",
    "steady_growth",
    "balanced_growth",
    "maximize_growth",
  ] as const,
  investingExperience: [
    "none",
    "some_ef_or_mp2",
    "some_uitf_or_stocks",
    "active_investor",
  ] as const,
  volatilityComfort: [
    "not_comfortable",
    "slightly_comfortable",
    "comfortable",
    "very_comfortable",
  ] as const,
};

export const riskAnswersSchema = z.object({
  marketDropReaction: z.enum(riskQuestionOptions.marketDropReaction),
  investmentHorizon: z.enum(riskQuestionOptions.investmentHorizon),
  primaryGoal: z.enum(riskQuestionOptions.primaryGoal),
  investingExperience: z.enum(riskQuestionOptions.investingExperience),
  volatilityComfort: z.enum(riskQuestionOptions.volatilityComfort),
});
export type RiskAnswers = z.infer<typeof riskAnswersSchema>;

// --- Current savings by category (§2.1) -----------------------------------
export const currentSavingsSchema = z.object({
  emergencyFund: z.coerce.number().min(0, "Cannot be negative"),
  mp2: z.coerce.number().min(0, "Cannot be negative"),
  uitf: z.coerce.number().min(0, "Cannot be negative"),
});
export type CurrentSavings = z.infer<typeof currentSavingsSchema>;

// --- Target goal: either a direct ₱ corpus amount, or a desired monthly
// retirement income (from which lib/goalCalc.ts derives the corpus via a
// withdrawal-rate assumption). Either way, the user always states the
// retirement age they're targeting (top-level field below) — the time
// horizon is needed regardless of how the target corpus itself is specified.
export const goalSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("amount"),
    targetAmount: z.coerce.number().positive("Enter a target amount greater than 0"),
  }),
  z.object({
    type: z.literal("income"),
    desiredMonthlyRetirementIncome: z.coerce
      .number()
      .positive("Enter a desired monthly retirement income greater than 0"),
  }),
]);
export type Goal = z.infer<typeof goalSchema>;

// --- Full intake form payload ----------------------------------------------
export const intakeFormSchema = z
  .object({
    age: z.coerce.number().int().min(18, "Must be 18 or older").max(70, "Must be 70 or younger"),
    monthlyIncome: z.coerce.number().positive("Monthly income must be greater than 0"),
    sideIncome: z.coerce.number().min(0, "Cannot be negative").default(0),
    currentSavings: currentSavingsSchema,
    currentMonthlySavingsRate: z.coerce.number().min(0, "Cannot be negative"),
    targetRetirementAge: z.coerce.number().int().min(18).max(100),
    goal: goalSchema,
    memberType: memberTypeSchema,
    creditedYearsOfService: z.coerce.number().min(0, "Cannot be negative"),
    riskAnswers: riskAnswersSchema,
  })
  .refine((data) => data.targetRetirementAge > data.age, {
    message: "Target retirement age must be greater than current age",
    path: ["targetRetirementAge"],
  });

export type IntakeFormValues = z.infer<typeof intakeFormSchema>;
