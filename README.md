# FreedomPath PH

An AI-powered web app that tells Filipino working professionals how much to save, where it should go (Emergency Fund/HYSA, Pag-IBIG MP2, UITF risk tier), and whether they're on track for their financial-freedom goal — including an SSS pension baseline estimate.

See [`PRD.md`](./PRD.md) for the product spec, [`spec.md`](./spec.md) and [`Architecture_Notes.md`](./Architecture_Notes.md) for technical design, and [`Idea_Validation_Report.md`](./Idea_Validation_Report.md) for the validation work behind the idea.

## Stack

Next.js 14 (App Router, TypeScript) · Tailwind CSS · Vercel AI SDK + OpenAI · Supabase (Postgres + Auth) · Vercel (hosting) · GitHub Actions (CI).

## How it works

1. **Intake form** — age, income, current savings by category, financial-freedom goal, and a few behavioral risk questions.
2. **Deterministic math, not AI** — the SSS pension estimate (`lib/sss.ts`, RA 11199 formula) and the required-monthly-savings gap (`lib/goalCalc.ts`, time-value-of-money) are pure functions, unit-tested against known values. The AI never calculates these numbers.
3. **AI risk profiling + narration** (`lib/ai.ts`) — classifies risk tolerance from the behavioral answers and writes a plain-language explanation of the plan. It's only allowed to cite rates that exist in `data/rates.json`; a server-side guardrail rejects any AI response that cites a rate not in that file, or that states a figure different from what `lib/sss.ts` / `lib/goalCalc.ts` actually computed.
4. **Save & Revisit** — an optional free account (Supabase Auth) lets a user save their plan and come back later to update it, without losing anything they already generated while signed out.

Every screen showing an AI-generated recommendation renders the `<Disclaimer />` component — this app gives educational information, not licensed financial advice.

## Getting started locally

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

### Environment variables

Set these in `.env.local` (never commit real values — `.env.local` is gitignored):

| Variable | Where to get it |
|---|---|
| `OPENAI_API_KEY` | OpenAI dashboard, or your course-provided key |
| `OPENAI_BASE_URL` | Only needed if your key is issued through a proxy (e.g. Vocareum) — leave blank for a direct OpenAI key |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase project → Settings → API |
| `SUPABASE_SECRET_KEY` | Supabase project → Settings → API (server-side only, never exposed to the browser) |

### Database setup

Run the migration in `supabase/migrations/0001_financial_plans.sql` against your Supabase project (via the SQL editor, or the Supabase CLI) to create the `financial_plans` table and its row-level-security policies before testing the Save & Revisit flow.

## Testing

```bash
npm test        # unit tests (vitest) — lib/sss.ts, goalCalc, allocation sums, risk classifier + fallback
npm run lint
npx tsc --noEmit
```

All three run automatically in CI (`.github/workflows/ci.yml`) on every push/PR to `main`.

## Deployment

Deployed on Vercel, connected to this repo's `main` branch. Every PR gets an automatic preview deployment; production deploys on merge to `main`. Vercel Analytics is enabled for basic traffic visibility.

`/api/plan` makes sequential OpenAI calls, so on Vercel's free Hobby tier (10s function timeout) response time is worth watching — see `Architecture_Notes.md` §5 for the fallback plan if that ever becomes a real constraint.

## Scope note (v1)

This is a course project, deliberately scoped narrow after validation work flagged over-engineering as the biggest risk (see `Idea_Validation_Report.md`, Step 7). Out-of-scope items — individual stock/bond trading, fund-name-level recommendations, push notifications, real payment processing — are listed in `PRD.md` §4 and intentionally left out.

**Legal boundary, stated plainly:** this app gives general, educational information, not licensed financial or investment advice, and recommendations stay at the risk-tier/category level rather than naming specific funds. Under the SEC's Financial Products and Services Consumer Protection Act (RA 11765) IRR, "Investment Adviser" status turns on giving such advice **for compensation** — since v1 has no real payment processing and is free to use, this meaningfully reduces registration exposure for the submitted project, but it is not a substitute for actual legal review. Before any real, commercial (paid) launch, a licensed-professional legal consult on investment-adviser registration would be required. See `PRD.md` §6 for the fuller research trail behind this decision.
