/**
 * Risk Profile Classification — lib/riskClassifier.ts
 *
 * Per spec.md §2.2, risk classification is normally an AI call (low
 * temperature, constrained to the 3-value enum below). This module holds the
 * deterministic, rule-based fallback classifier that the AI call must fall
 * back to whenever its response fails to parse into a valid enum — so the
 * flow never breaks. It is a simple point-scoring system across the 5
 * behavioral answers defined in lib/schemas.ts.
 *
 * `classifyRiskRuleBased` is also perfectly usable on its own (e.g. before
 * the OpenAI integration lands), which is what powers /api/plan today.
 */
import { RiskAnswers, riskQuestionOptions } from "./schemas";

export const RISK_PROFILES = ["conservative", "moderate", "aggressive"] as const;
export type RiskProfile = (typeof RISK_PROFILES)[number];

export interface RiskClassificationResult {
  riskProfile: RiskProfile;
  /** Plain-language explanation of why, per spec.md §2.2. */
  explanation: string;
  /** Raw point score (5-20) behind the classification, for debugging/testing. */
  score: number;
}

/** Type guard used to validate an AI response before trusting it (task: AI integration). */
export function isValidRiskProfile(value: unknown): value is RiskProfile {
  return (
    typeof value === "string" && (RISK_PROFILES as readonly string[]).includes(value)
  );
}

const SCORE_THRESHOLDS = {
  conservativeMax: 9, // score <= 9
  moderateMax: 15, // 10 <= score <= 15
  // score >= 16 -> aggressive
};

/** Each question's options are ordered conservative -> aggressive; score = index + 1 (1-4 points). */
function optionScore<T extends readonly string[]>(options: T, value: T[number]): number {
  const index = options.indexOf(value);
  return index === -1 ? 1 : index + 1;
}

export function classifyRiskRuleBased(answers: RiskAnswers): RiskClassificationResult {
  const score =
    optionScore(riskQuestionOptions.marketDropReaction, answers.marketDropReaction) +
    optionScore(riskQuestionOptions.investmentHorizon, answers.investmentHorizon) +
    optionScore(riskQuestionOptions.primaryGoal, answers.primaryGoal) +
    optionScore(riskQuestionOptions.investingExperience, answers.investingExperience) +
    optionScore(riskQuestionOptions.volatilityComfort, answers.volatilityComfort);

  let riskProfile: RiskProfile;
  if (score <= SCORE_THRESHOLDS.conservativeMax) {
    riskProfile = "conservative";
  } else if (score <= SCORE_THRESHOLDS.moderateMax) {
    riskProfile = "moderate";
  } else {
    riskProfile = "aggressive";
  }

  const explanations: Record<RiskProfile, string> = {
    conservative:
      "Your answers lean toward protecting what you have over chasing higher returns, so we're weighting your plan toward safer, more stable vehicles.",
    moderate:
      "Your answers show a balance between growth and stability, so we're weighting your plan toward a mix of steady and growth-oriented vehicles.",
    aggressive:
      "Your answers show comfort with short-term ups and downs in exchange for higher long-term growth, so we're weighting your plan toward growth-oriented vehicles.",
  };

  return { riskProfile, explanation: explanations[riskProfile], score };
}
