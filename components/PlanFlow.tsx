"use client";

import { useState, FormEvent } from "react";
import { intakeFormSchema, riskQuestionOptions, type IntakeFormValues } from "@/lib/schemas";
import { ResultScreen, type PlanResult } from "@/components/ResultScreen";
import { SavePlanPanel } from "@/components/SavePlanPanel";

type GoalType = "amount" | "income";
type MemberType = "employed" | "self-employed" | "voluntary" | "ofw";

interface FormState {
  age: string;
  monthlyIncome: string;
  sideIncome: string;
  emergencyFund: string;
  mp2: string;
  uitf: string;
  currentMonthlySavingsRate: string;
  targetRetirementAge: string;
  goalType: GoalType;
  targetAmount: string;
  desiredMonthlyRetirementIncome: string;
  memberType: MemberType;
  creditedYearsOfService: string;
  marketDropReaction: string;
  investmentHorizon: string;
  primaryGoal: string;
  investingExperience: string;
  volatilityComfort: string;
}

const emptyState: FormState = {
  age: "",
  monthlyIncome: "",
  sideIncome: "0",
  emergencyFund: "0",
  mp2: "0",
  uitf: "0",
  currentMonthlySavingsRate: "",
  targetRetirementAge: "",
  goalType: "amount",
  targetAmount: "",
  desiredMonthlyRetirementIncome: "",
  memberType: "employed",
  creditedYearsOfService: "0",
  marketDropReaction: riskQuestionOptions.marketDropReaction[0],
  investmentHorizon: riskQuestionOptions.investmentHorizon[0],
  primaryGoal: riskQuestionOptions.primaryGoal[0],
  investingExperience: riskQuestionOptions.investingExperience[0],
  volatilityComfort: riskQuestionOptions.volatilityComfort[0],
};

/** Converts a saved/validated intake payload back into form field strings, for regeneration. */
function intakeToFormState(intake: IntakeFormValues): FormState {
  return {
    age: String(intake.age),
    monthlyIncome: String(intake.monthlyIncome),
    sideIncome: String(intake.sideIncome),
    emergencyFund: String(intake.currentSavings.emergencyFund),
    mp2: String(intake.currentSavings.mp2),
    uitf: String(intake.currentSavings.uitf),
    currentMonthlySavingsRate: String(intake.currentMonthlySavingsRate),
    targetRetirementAge: String(intake.targetRetirementAge),
    goalType: intake.goal.type,
    targetAmount: intake.goal.type === "amount" ? String(intake.goal.targetAmount) : "",
    desiredMonthlyRetirementIncome:
      intake.goal.type === "income" ? String(intake.goal.desiredMonthlyRetirementIncome) : "",
    memberType: intake.memberType,
    creditedYearsOfService: String(intake.creditedYearsOfService),
    marketDropReaction: intake.riskAnswers.marketDropReaction,
    investmentHorizon: intake.riskAnswers.investmentHorizon,
    primaryGoal: intake.riskAnswers.primaryGoal,
    investingExperience: intake.riskAnswers.investingExperience,
    volatilityComfort: intake.riskAnswers.volatilityComfort,
  };
}

const RISK_QUESTION_LABELS: Record<string, { question: string; options: Record<string, string> }> = {
  marketDropReaction: {
    question: "If your investments suddenly dropped 15% in value, you would most likely...",
    options: {
      sell_everything: "Sell everything to avoid further loss",
      sell_some: "Sell some of it to reduce risk",
      hold: "Hold and wait it out",
      buy_more: "See it as an opportunity to buy more",
    },
  },
  investmentHorizon: {
    question: "How long until you'll need this money?",
    options: {
      under_3_years: "Less than 3 years",
      "3_to_7_years": "3 to 7 years",
      "7_to_15_years": "7 to 15 years",
      "15_plus_years": "15+ years",
    },
  },
  primaryGoal: {
    question: "What matters most to you?",
    options: {
      capital_preservation: "Protecting what I already have",
      steady_growth: "Steady, modest growth",
      balanced_growth: "A balance of growth and safety",
      maximize_growth: "Maximizing long-term growth",
    },
  },
  investingExperience: {
    question: "How would you describe your investing experience?",
    options: {
      none: "No experience yet",
      some_ef_or_mp2: "Some — mostly savings/MP2",
      some_uitf_or_stocks: "Some — UITFs or stocks before",
      active_investor: "I actively invest already",
    },
  },
  volatilityComfort: {
    question: "How comfortable are you with short-term ups and downs for potentially higher returns?",
    options: {
      not_comfortable: "Not comfortable at all",
      slightly_comfortable: "Slightly comfortable",
      comfortable: "Comfortable",
      very_comfortable: "Very comfortable",
    },
  },
};

export interface PlanFlowProps {
  /** Pre-fills the form for regeneration (e.g. from a previously saved plan). */
  initialIntake?: IntakeFormValues;
  /** Shows a saved result immediately instead of the empty form on first render. */
  initialResult?: PlanResult;
}

export function PlanFlow({ initialIntake, initialResult }: PlanFlowProps) {
  const [form, setForm] = useState<FormState>(
    initialIntake ? intakeToFormState(initialIntake) : emptyState
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResult | null>(initialResult ?? null);
  const [lastIntake, setLastIntake] = useState<unknown | null>(initialIntake ?? null);
  const [editing, setEditing] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildPayload() {
    return {
      age: form.age,
      monthlyIncome: form.monthlyIncome,
      sideIncome: form.sideIncome,
      currentSavings: {
        emergencyFund: form.emergencyFund,
        mp2: form.mp2,
        uitf: form.uitf,
      },
      currentMonthlySavingsRate: form.currentMonthlySavingsRate,
      targetRetirementAge: form.targetRetirementAge,
      goal:
        form.goalType === "amount"
          ? { type: "amount" as const, targetAmount: form.targetAmount }
          : {
              type: "income" as const,
              desiredMonthlyRetirementIncome: form.desiredMonthlyRetirementIncome,
            },
      memberType: form.memberType,
      creditedYearsOfService: form.creditedYearsOfService,
      riskAnswers: {
        marketDropReaction: form.marketDropReaction,
        investmentHorizon: form.investmentHorizon,
        primaryGoal: form.primaryGoal,
        investingExperience: form.investingExperience,
        volatilityComfort: form.volatilityComfort,
      },
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setServerError(null);
    setErrors({});

    const payload = buildPayload();

    // Client-side validation first, using the SAME shared schema the API
    // route uses server-side (CLAUDE.md hard rule #6) — immediate feedback,
    // never trusted as the only check.
    const parsed = intakeFormSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join(".")] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setServerError(body.error ?? "Something went wrong generating your plan.");
        return;
      }
      const data = (await response.json()) as PlanResult;
      setResult(data);
      setLastIntake(parsed.data);
      setEditing(false);
    } catch {
      setServerError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result && !editing) {
    return (
      <div className="space-y-6 pb-10">
        <ResultScreen result={result} />
        <div className="mx-auto max-w-2xl space-y-4 px-6">
          <SavePlanPanel intake={lastIntake} result={result} />
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-slate-500 underline hover:text-slate-700"
          >
            Update my numbers and regenerate
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">
        {initialIntake ? "Update Your Plan" : "Get Your Plan"}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        A few questions about your income, savings, and goals — takes about 2 minutes.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        <Section title="About you">
          <Field label="Age" error={errors["age"]}>
            <input
              type="number"
              className={inputClass}
              value={form.age}
              onChange={(e) => update("age", e.target.value)}
            />
          </Field>
          <Field label="Monthly income (₱)" error={errors["monthlyIncome"]}>
            <input
              type="number"
              className={inputClass}
              value={form.monthlyIncome}
              onChange={(e) => update("monthlyIncome", e.target.value)}
            />
          </Field>
          <Field label="Side/freelance income (₱, optional)" error={errors["sideIncome"]}>
            <input
              type="number"
              className={inputClass}
              value={form.sideIncome}
              onChange={(e) => update("sideIncome", e.target.value)}
            />
          </Field>
        </Section>

        <Section title="Current savings">
          <Field label="Emergency Fund / HYSA balance (₱)" error={errors["currentSavings.emergencyFund"]}>
            <input
              type="number"
              className={inputClass}
              value={form.emergencyFund}
              onChange={(e) => update("emergencyFund", e.target.value)}
            />
          </Field>
          <Field label="Pag-IBIG MP2 balance (₱)" error={errors["currentSavings.mp2"]}>
            <input
              type="number"
              className={inputClass}
              value={form.mp2}
              onChange={(e) => update("mp2", e.target.value)}
            />
          </Field>
          <Field label="UITF / other investments balance (₱)" error={errors["currentSavings.uitf"]}>
            <input
              type="number"
              className={inputClass}
              value={form.uitf}
              onChange={(e) => update("uitf", e.target.value)}
            />
          </Field>
          <Field
            label="How much do you currently save/invest per month? (₱)"
            error={errors["currentMonthlySavingsRate"]}
          >
            <input
              type="number"
              className={inputClass}
              value={form.currentMonthlySavingsRate}
              onChange={(e) => update("currentMonthlySavingsRate", e.target.value)}
            />
          </Field>
        </Section>

        <Section title="Your goal">
          <Field label="Target retirement age" error={errors["targetRetirementAge"]}>
            <input
              type="number"
              className={inputClass}
              value={form.targetRetirementAge}
              onChange={(e) => update("targetRetirementAge", e.target.value)}
            />
          </Field>
          <Field label="How would you like to set your goal?">
            <select
              className={inputClass}
              value={form.goalType}
              onChange={(e) => update("goalType", e.target.value as GoalType)}
            >
              <option value="amount">I have a target ₱ amount in mind</option>
              <option value="income">I have a desired monthly retirement income in mind</option>
            </select>
          </Field>
          {form.goalType === "amount" ? (
            <Field label="Target retirement corpus (₱)" error={errors["goal.targetAmount"]}>
              <input
                type="number"
                className={inputClass}
                value={form.targetAmount}
                onChange={(e) => update("targetAmount", e.target.value)}
              />
            </Field>
          ) : (
            <Field
              label="Desired monthly retirement income (₱)"
              error={errors["goal.desiredMonthlyRetirementIncome"]}
            >
              <input
                type="number"
                className={inputClass}
                value={form.desiredMonthlyRetirementIncome}
                onChange={(e) => update("desiredMonthlyRetirementIncome", e.target.value)}
              />
            </Field>
          )}
        </Section>

        <Section title="SSS details">
          <Field label="Member type">
            <select
              className={inputClass}
              value={form.memberType}
              onChange={(e) => update("memberType", e.target.value as MemberType)}
            >
              <option value="employed">Employed</option>
              <option value="self-employed">Self-employed</option>
              <option value="voluntary">Voluntary member</option>
              <option value="ofw">OFW</option>
            </select>
          </Field>
          <Field
            label="Credited years of SSS contributions"
            error={errors["creditedYearsOfService"]}
          >
            <input
              type="number"
              className={inputClass}
              value={form.creditedYearsOfService}
              onChange={(e) => update("creditedYearsOfService", e.target.value)}
            />
          </Field>
        </Section>

        <Section title="A few quick questions about how you handle risk">
          {(
            [
              "marketDropReaction",
              "investmentHorizon",
              "primaryGoal",
              "investingExperience",
              "volatilityComfort",
            ] as const
          ).map((key) => (
            <Field key={key} label={RISK_QUESTION_LABELS[key].question}>
              <select
                className={inputClass}
                value={form[key]}
                onChange={(e) => update(key, e.target.value)}
              >
                {Object.entries(RISK_QUESTION_LABELS[key].options).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </Section>

        {serverError && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {serverError}
          </p>
        )}

        <div className="flex gap-3">
          {editing && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-slate-300 px-6 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-slate-900 px-6 py-3 text-base font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {submitting ? "Generating your plan..." : "Get My Plan"}
          </button>
        </div>
      </form>
    </main>
  );
}

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-xl border border-slate-200 p-5">
      <legend className="px-1 text-sm font-semibold text-slate-700">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {children}
      {error && <span className="mt-1 block text-xs font-normal text-red-600">{error}</span>}
    </label>
  );
}
