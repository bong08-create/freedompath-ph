/**
 * AI Layer — lib/ai.ts
 *
 * Two OpenAI calls per plan generation, exactly as described in
 * Architecture_Notes.md §2.3, with the deterministic calculation (lib/sss.ts
 * + lib/goalCalc.ts) sandwiched between them by the caller (app/api/plan):
 *
 *   1. classifyRisk()        — risk classification (low temp, constrained enum)
 *   2. generateRecommendation() — narrative + allocation, grounded in the
 *      already-computed figures and data/rates.json; never recalculates
 *      anything and never states a rate the data file doesn't contain.
 *
 * IMPLEMENTATION NOTE: the project stack is documented as "Vercel AI SDK +
 * OpenAI." This module uses the official `openai` SDK directly (already a
 * project dependency) rather than the `ai` package's `generateObject`, which
 * would require adding `@ai-sdk/openai` at a version matched to the
 * currently-installed `ai@3.4.x` — something that couldn't be verified
 * against the npm registry from this environment. The `openai` SDK's
 * built-in structured-outputs helper (`zodResponseFormat` + `.parse()`)
 * gives the same guarantee (schema-validated JSON, no hand-rolled parsing)
 * with zero added dependency risk. Functionally nothing else about the
 * architecture changes. Flagging this here per CLAUDE.md's "flag deviations
 * rather than silently implementing" guidance.
 *
 * Every code path below is designed to NEVER throw and NEVER leave the user
 * without a plan: missing API key, network failure, malformed AI response,
 * or a failed guardrail all fall back to the deterministic, rule-based
 * implementations in lib/riskClassifier.ts and lib/allocation.ts.
 */
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { RiskAnswers } from "./schemas";
import { classifyRiskRuleBased, isValidRiskProfile, type RiskProfile } from "./riskClassifier";
import {
  allocationSumsTo100,
  getDefaultAllocation,
  getRatesForRiskProfile,
  getUitfTierLabel,
  type AllocationPercentages,
} from "./allocation";
import type { SSSPensionResult } from "./sss";
import type { GoalCalcResult } from "./goalCalc";
import ratesData from "../data/rates.json";

const MODEL = "gpt-4o-mini"; // fast + cheap, per Architecture_Notes.md §5 (Vercel free-tier 10s timeout risk)

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  // OPENAI_BASE_URL is optional — needed when the key is issued through a
  // proxy/gateway (e.g. a course's Vocareum-provided key) rather than
  // directly against api.openai.com.
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  return new OpenAI({ apiKey, baseURL });
}

// ============================================================================
// 1. Risk classification (spec.md §2.2)
// ============================================================================

export interface RiskClassificationOutcome {
  riskProfile: RiskProfile;
  explanation: string;
  source: "ai" | "rule_based_fallback";
}

const riskClassificationSchema = z.object({
  riskProfile: z.enum(["conservative", "moderate", "aggressive"]),
  explanation: z
    .string()
    .min(1)
    .max(400)
    .describe("1-2 plain-language sentences, written directly to the user, explaining why."),
});

export async function classifyRisk(answers: RiskAnswers): Promise<RiskClassificationOutcome> {
  const client = getClient();
  if (!client) {
    const fallback = classifyRiskRuleBased(answers);
    return { riskProfile: fallback.riskProfile, explanation: fallback.explanation, source: "rule_based_fallback" };
  }

  try {
    const completion = await client.beta.chat.completions.parse({
      model: MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You classify a user's investing risk tolerance for a Filipino personal-finance app, " +
            "based on their answers to 5 behavioral questions. Respond with exactly one of: " +
            "conservative, moderate, aggressive — plus a 1-2 sentence plain-language explanation " +
            "written directly to the user (second person, no jargon).",
        },
        { role: "user", content: `Behavioral answers (JSON): ${JSON.stringify(answers)}` },
      ],
      response_format: zodResponseFormat(riskClassificationSchema, "risk_classification"),
    });

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed || !isValidRiskProfile(parsed.riskProfile)) {
      throw new Error("AI risk classification response failed validation");
    }

    return { riskProfile: parsed.riskProfile, explanation: parsed.explanation, source: "ai" };
  } catch (error) {
    // Any failure (network, timeout, malformed response) falls back silently
    // to the deterministic classifier — the flow must never break for the
    // user, but we log server-side so the failure is still visible in dev.
    console.error("[lib/ai] classifyRisk: AI call failed, using rule-based fallback:", error);
    const fallback = classifyRiskRuleBased(answers);
    return { riskProfile: fallback.riskProfile, explanation: fallback.explanation, source: "rule_based_fallback" };
  }
}

// ============================================================================
// 2. Recommendation narrative + allocation (spec.md §2.5)
// ============================================================================

export interface RecommendationInput {
  age: number;
  riskProfile: RiskProfile;
  riskExplanation: string;
  sss: SSSPensionResult;
  goalCalc: GoalCalcResult;
}

export interface RecommendationOutcome {
  narrative: string;
  allocation: AllocationPercentages;
  levers: string[];
  uitfTierLabel: string;
  source: "ai" | "template_fallback";
}

const recommendationSchema = z.object({
  narrative: z
    .string()
    .min(1)
    .describe(
      "2-4 sentence plain-language narrative restating (not recalculating) the required monthly " +
        "savings and gap figures given, written directly to the user."
    ),
  allocation: z.object({
    emergencyFundHysa: z.number().min(0).max(100),
    pagibigMp2: z.number().min(0).max(100),
    uitf: z.number().min(0).max(100),
  }),
  levers: z
    .array(z.string().min(1))
    .min(2)
    .max(3)
    .describe(
      "2-3 concrete actions to close the gap, if behind. Make each one specific and actionable: " +
        "name the category/instrument type (e.g. 'a digital bank savings account', 'a UITF Balanced " +
        "Fund', 'Pag-IBIG MP2') and cite the actual rate from CURRENT_RATES where relevant (e.g. " +
        "'...paying around 2.3% p.a. with no lock-in'), so the user knows roughly what to look for " +
        "and where. Never name a specific bank or fund product by name."
    ),
});

const MAX_ATTEMPTS = 2; // per Architecture_Notes.md §2.3: reject+regenerate once, then fall back to template

export async function generateRecommendation(
  input: RecommendationInput
): Promise<RecommendationOutcome> {
  const client = getClient();
  const uitfTierLabel = getUitfTierLabel(input.riskProfile);

  if (!client) {
    return { ...templateFallback(input), uitfTierLabel, source: "template_fallback" };
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const completion = await client.beta.chat.completions.parse({
        model: MODEL,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You write a short, plain-language savings recommendation for a Filipino personal-" +
              "finance app. CRITICAL RULES: (1) Restate the SAVINGS_TARGET and GAP figures given " +
              "below EXACTLY as given — never recalculate or alter them. Write peso amounts with a " +
              "'₱' prefix and comma separators (e.g. ₱33,227), never as bare numbers. (2) Only ever " +
              "reference rate/dividend figures present in CURRENT_RATES below — never state a " +
              "percentage or rate not present there. (3) Your allocation percentages across " +
              "emergencyFundHysa, pagibigMp2, and uitf must sum to exactly 100. (4) Never name a " +
              "specific bank or fund product — stay at the category/risk-tier level.",
          },
          {
            role: "user",
            content: JSON.stringify({
              age: input.age,
              risk_profile: input.riskProfile,
              SAVINGS_TARGET: input.goalCalc.requiredMonthlyContribution,
              GAP: input.goalCalc.gapPerMonth,
              status: input.goalCalc.status,
              target_retirement_corpus: input.goalCalc.targetRetirementCorpus,
              sss_estimated_monthly_pension: input.sss.estimatedMonthlyPension,
              CURRENT_RATES: ratesData.vehicles,
              uitf_tier_for_this_risk_profile: uitfTierLabel,
            }),
          },
        ],
        response_format: zodResponseFormat(recommendationSchema, "recommendation"),
      });

      const parsed = completion.choices[0]?.message?.parsed;
      if (parsed && validateRecommendation(parsed, input)) {
        return {
          narrative: parsed.narrative,
          allocation: parsed.allocation,
          levers: parsed.levers,
          uitfTierLabel,
          source: "ai",
        };
      }
      console.error(
        `[lib/ai] generateRecommendation: attempt ${attempt} failed the guardrail check, parsed:`,
        parsed
      );
    } catch (error) {
      console.error(`[lib/ai] generateRecommendation: attempt ${attempt} threw an error:`, error);
    }
  }

  console.error("[lib/ai] generateRecommendation: all attempts exhausted, using template fallback");
  return { ...templateFallback(input), uitfTierLabel, source: "template_fallback" };
}

/**
 * Server-side guardrail (Architecture_Notes.md §2.3): reject the AI response
 * unless (a) it restates the exact required-savings/gap figures, (b) its
 * allocation sums to 100, and (c) every percentage it cites traces back to
 * data/rates.json or the allocation itself. Not a substring match — extracts
 * every number-like token from the narrative so formatting (commas, ₱,
 * decimals) can't cause a false rejection.
 */
function validateRecommendation(
  parsed: z.infer<typeof recommendationSchema>,
  input: RecommendationInput
): boolean {
  if (!allocationSumsTo100(parsed.allocation)) return false;

  const narrativeNumbers = extractNumbers(parsed.narrative);

  if (!narrativeNumbers.some((n) => pesoCloseEnough(n, input.goalCalc.requiredMonthlyContribution))) {
    return false;
  }
  if (
    input.goalCalc.status !== "on-track" &&
    !narrativeNumbers.some((n) => pesoCloseEnough(n, input.goalCalc.gapPerMonth))
  ) {
    return false;
  }

  // Levers can now cite rates too (per the more concrete/actionable prompt),
  // so every percentage mentioned in EITHER the narrative or the levers must
  // trace back to rates.json or the allocation itself — never invented.
  const citedPercents = [
    ...extractPercents(parsed.narrative),
    ...parsed.levers.flatMap(extractPercents),
  ];
  const allowedPercents = [
    ...ratesData.vehicles.map((v) => v.rate_pct),
    parsed.allocation.emergencyFundHysa,
    parsed.allocation.pagibigMp2,
    parsed.allocation.uitf,
  ];
  const hasUnsourcedRate = citedPercents.some(
    (p) => !allowedPercents.some((allowed) => Math.abs(allowed - p) < 0.05)
  );
  if (hasUnsourcedRate) return false;

  return true;
}

function extractNumbers(text: string): number[] {
  const matches = text.match(/[\d][\d,]*(?:\.\d+)?/g) ?? [];
  return matches.map((m) => Number(m.replace(/,/g, ""))).filter((n) => !Number.isNaN(n));
}

function extractPercents(text: string): number[] {
  const matches = text.match(/(\d+(?:\.\d+)?)\s*%/g) ?? [];
  return matches.map((m) => Number(m.replace("%", "")));
}

function pesoCloseEnough(a: number, b: number): boolean {
  return Math.abs(a - b) < 1; // within ₱1, absorbs rounding
}

/** Deterministic, template-based response used when the AI is unavailable or fails guardrails twice. */
function templateFallback(
  input: RecommendationInput
): Pick<RecommendationOutcome, "narrative" | "allocation" | "levers"> {
  const allocation = getDefaultAllocation(input.riskProfile);
  const { goalCalc } = input;

  const requiredRounded = Math.round(goalCalc.requiredMonthlyContribution).toLocaleString("en-PH");
  const gapRounded = Math.round(goalCalc.gapPerMonth).toLocaleString("en-PH");

  const paceLine =
    goalCalc.status === "behind"
      ? `You'd need to save about ₱${gapRounded} more per month to close the gap.`
      : goalCalc.status === "ahead"
        ? `You're currently saving about ₱${gapRounded} more per month than required — you're ahead of pace.`
        : `You're right on track at your current savings rate.`;

  const narrative =
    `Based on your ${input.riskProfile} risk profile, aim to save around ` +
    `₱${requiredRounded} per month to reach your goal. ${paceLine}`;

  const { hysaRate, mp2Rate, uitfRate } = getRatesForRiskProfile(input.riskProfile);

  const levers =
    goalCalc.status === "behind"
      ? [
          `Automate a transfer to a digital bank savings account (Emergency Fund/HYSA) on payday — ` +
            `look for one paying around ${hysaRate}% p.a. with no lock-in, so saving happens before spending.`,
          `Redirect side-income or bonuses toward Pag-IBIG MP2, which is currently earning a tax-free ` +
            `${mp2Rate}% annual dividend with no market risk.`,
          `Consider a UITF ${getUitfTierLabel(input.riskProfile)} at your existing bank — recent ` +
            `indicative returns for this risk tier have been around ${uitfRate}%.`,
        ]
      : [
          "Keep your current contributions automated so you stay on pace.",
          "Revisit your plan yearly, or whenever your income or goal changes.",
        ];

  return { narrative, allocation, levers };
}
