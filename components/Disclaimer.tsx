/**
 * Shared disclaimer component — per CLAUDE.md hard rule #3, this must be
 * rendered on every screen that shows an AI-generated recommendation.
 * Do not make this conditionally hidden or removable.
 */
export function Disclaimer() {
  return (
    <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">This is educational information, not financial advice.</p>
      <p className="mt-1">
        FreedomPath PH provides general, educational information to help you
        think through your savings and investment options. It is not a
        licensed financial or investment adviser, and this is not
        personalized investment advice. Rates and figures shown are based on
        publicly available data as of the &quot;last updated&quot; date shown
        and may have changed. Please verify current rates directly with each
        institution and consult a licensed financial adviser before making
        investment decisions.
      </p>
    </div>
  );
}
