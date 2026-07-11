import { Disclaimer } from "./Disclaimer";

export interface PlanResult {
  riskProfile: "conservative" | "moderate" | "aggressive";
  riskExplanation: string;
  sss: {
    eligibleForMonthlyPension: boolean;
    estimatedMonthlyPension: number;
    thirteenthMonthPensionNote: string;
  };
  goalCalc: {
    yearsToRetirement: number;
    targetRetirementCorpus: number;
    requiredMonthlyContribution: number;
    projectedCorpusAtCurrentRate: number;
    status: "ahead" | "on-track" | "behind";
    gapPerMonth: number;
    assumptions: { annualReturnRate: number; withdrawalRate: number | null };
  };
  allocation: {
    emergencyFundHysa: number;
    pagibigMp2: number;
    uitf: number;
  };
  uitfTierLabel: string;
  blendedAnnualReturnRatePct: number;
  narrative: string;
  levers: string[];
  sources: { name: string; rate_pct: number; source: string; as_of: string }[];
  ratesLastReviewed: string;
}

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const STATUS_COPY: Record<PlanResult["goalCalc"]["status"], { label: string; className: string }> = {
  ahead: { label: "Ahead of pace", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  "on-track": { label: "On track", className: "bg-sky-50 text-sky-800 border-sky-200" },
  behind: { label: "Behind pace", className: "bg-amber-50 text-amber-900 border-amber-200" },
};

const RISK_LABEL: Record<PlanResult["riskProfile"], string> = {
  conservative: "Conservative",
  moderate: "Moderate",
  aggressive: "Aggressive",
};

export function ResultScreen({ result }: { result: PlanResult }) {
  const {
    goalCalc,
    sss,
    allocation,
    riskProfile,
    riskExplanation,
    blendedAnnualReturnRatePct,
    uitfTierLabel,
    narrative,
    levers,
    sources,
    ratesLastReviewed,
  } = result;
  const status = STATUS_COPY[goalCalc.status];
  // The % split applies to your recommended monthly savings amount. If
  // you're already ahead of pace, that's your current rate (required +
  // your surplus) rather than the smaller required figure alone.
  const monthlyAmountToAllocate =
    goalCalc.status === "ahead"
      ? goalCalc.requiredMonthlyContribution + goalCalc.gapPerMonth
      : goalCalc.requiredMonthlyContribution;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your FreedomPath Plan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Risk profile: <span className="font-medium text-slate-700">{RISK_LABEL[riskProfile]}</span>
        </p>
        <p className="mt-2 text-sm text-slate-600">{riskExplanation}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-700">{narrative}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Required Monthly Savings</h2>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}
          >
            {status.label}
          </span>
        </div>
        <p className="mt-3 text-3xl font-bold text-slate-900">
          {peso.format(goalCalc.requiredMonthlyContribution)}
          <span className="text-base font-normal text-slate-500"> / month</span>
        </p>
        {goalCalc.status === "behind" && (
          <p className="mt-1 text-sm text-amber-800">
            That&apos;s {peso.format(goalCalc.gapPerMonth)} more per month than you&apos;re currently saving.
          </p>
        )}
        {goalCalc.status === "ahead" && (
          <p className="mt-1 text-sm text-emerald-700">
            You&apos;re currently saving {peso.format(goalCalc.gapPerMonth)} more per month than required — nice work.
          </p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">Total savings you&apos;ll need by then</dt>
            <dd className="font-medium text-slate-800">{peso.format(goalCalc.targetRetirementCorpus)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Years to retirement</dt>
            <dd className="font-medium text-slate-800">{goalCalc.yearsToRetirement}</dd>
          </div>
          <div>
            <dt className="text-slate-500">What you&apos;ll have at your current pace</dt>
            <dd className="font-medium text-slate-800">
              {peso.format(goalCalc.projectedCorpusAtCurrentRate)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Assumed yearly growth on your savings</dt>
            <dd className="font-medium text-slate-800">{blendedAnnualReturnRatePct}%</dd>
          </div>
        </dl>
        {goalCalc.assumptions.withdrawalRate !== null && (
          <p className="mt-3 text-xs text-slate-400">
            Assumes you&apos;ll draw down {(goalCalc.assumptions.withdrawalRate * 100).toFixed(0)}% of your
            savings per year in retirement, used to work out the total amount you&apos;ll need saved up.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Recommended Allocation</h2>
        <p className="mt-1 text-sm text-slate-500">
          Where your {peso.format(monthlyAmountToAllocate)}/month should go, based on your{" "}
          {RISK_LABEL[riskProfile].toLowerCase()} risk profile.
        </p>
        <div className="mt-4 space-y-3">
          <AllocationBar
            label="Emergency Fund / HYSA"
            percent={allocation.emergencyFundHysa}
            amount={(allocation.emergencyFundHysa / 100) * monthlyAmountToAllocate}
          />
          <AllocationBar
            label="Pag-IBIG MP2"
            percent={allocation.pagibigMp2}
            amount={(allocation.pagibigMp2 / 100) * monthlyAmountToAllocate}
          />
          <AllocationBar
            label={`UITF – ${uitfTierLabel}`}
            percent={allocation.uitf}
            amount={(allocation.uitf / 100) * monthlyAmountToAllocate}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">SSS Pension Baseline (Estimate)</h2>
        {sss.eligibleForMonthlyPension ? (
          <>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {peso.format(sss.estimatedMonthlyPension)}
              <span className="text-base font-normal text-slate-500"> / month</span>
            </p>
            <p className="mt-2 text-xs text-slate-500">{sss.thirteenthMonthPensionNote}</p>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-600">{sss.thirteenthMonthPensionNote}</p>
        )}
        <p className="mt-3 text-xs text-slate-400">
          This is a simplified, self-reported estimate — not an official SSS computation.
        </p>
      </div>

      {levers.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Ways to Close the Gap</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-700">
            {levers.map((lever, i) => (
              <li key={i}>{lever}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Sources</h2>
        <p className="mt-1 text-xs text-slate-400">Rates last reviewed {ratesLastReviewed}</p>
        <ul className="mt-3 space-y-2 text-sm">
          {sources.map((s) => (
            <li key={s.name} className="flex items-center justify-between gap-4">
              <span className="text-slate-700">{s.name}</span>
              <a
                href={s.source}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-xs text-slate-500 underline hover:text-slate-700"
              >
                {s.rate_pct}% (as of {s.as_of})
              </a>
            </li>
          ))}
        </ul>
      </div>

      <Disclaimer />
    </div>
  );
}

function AllocationBar({
  label,
  percent,
  amount,
}: {
  label: string;
  percent: number;
  amount: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-700">{label}</span>
        <span className="font-medium text-slate-900">
          {percent}% · {peso.format(amount)}
        </span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-slate-900"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
