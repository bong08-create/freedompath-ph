# Architecture Notes — FreedomPath PH

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT (Next.js App Router, Tailwind)                           │
│  - Intake form (React, client-side zod validation)               │
│  - Result screen (allocation chart, gap summary, disclaimer)     │
│  - Auth UI (Supabase Auth: email or OAuth)                       │
└───────────────┬─────────────────────────────────────────────────┘
                │ POST /api/plan (server action or route handler)
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND (Next.js Route Handlers, server-side only)               │
│  1. Re-validate input (zod) — never trust client validation       │
│  2. Call OpenAI (low temp) → risk profile classification          │
│     (fallback: rule-based classifier if parse fails)              │
│  3. lib/sss.ts — deterministic SSS pension calculation             │
│  4. lib/goalCalc.ts — deterministic required-monthly-savings       │
│     calculation (time-value-of-money; uses risk profile to pick   │
│     a blended expected return rate)                                │
│  5. Load data/rates.json — current vehicle rates (version-        │
│     controlled, manually updated monthly)                        │
│  6. Call OpenAI again → narrative + allocation recommendation,    │
│     grounded in steps 2-5's outputs (never recalculates them)     │
│  7. Guardrail check: reject/regenerate if the narrative's ₱       │
│     figures don't match step 4's output, or if it states a rate   │
│     not present in rates.json; append disclaimer if omitted       │
│  8. Return structured JSON to client                              │
└───────┬─────────────────────────────────────────┬─────────────────┘
        │                                         │
        ▼                                         ▼
┌────────────────────┐                 ┌─────────────────────────┐
│  SUPABASE (Postgres) │                 │  OpenAI (via Vercel AI  │
│  - auth.users         │                 │  SDK)                    │
│  - financial_plans     │                 │  - risk classification   │
│    table (1 row per   │                 │  - recommendation text   │
│    user's saved plan) │                 │  generation               │
└────────────────────┘                 └─────────────────────────┘
```

## 2. Layers

### 2.1 UI Layer (Next.js 14 App Router + Tailwind)
- `/` — landing/explainer + CTA
- `/plan` — intake form → result screen (client component, calls `/api/plan`)
- `/plan/saved` — signed-in user's saved plan (server component, reads from Supabase)
- `/auth/*` — Supabase Auth UI (sign up/sign in)
- Shared `<Disclaimer />` component rendered on every result view — not optional, not conditionally hidden.

### 2.2 Backend Layer (Next.js Route Handlers)
- `POST /api/plan` — the core endpoint described in the diagram above. Stateless; does not require auth to call (unauthenticated users can generate a plan).
- `POST /api/plan/save` — requires auth; upserts the current plan into `financial_plans`.
- `GET /api/plan/latest` — requires auth; returns the signed-in user's most recent saved plan.
- All routes validate input server-side with the same zod schemas used client-side (shared in `lib/schemas.ts`).

### 2.3 AI Layer (Vercel AI SDK + OpenAI)
- Two model calls per plan generation, with deterministic calculation sandwiched between them — kept separate for reliability and easier testing:
  1. **Risk classification call** (first) — low temperature, constrained output (enum: conservative/moderate/aggressive + short rationale). If the response fails to parse into a valid enum, fall back to a deterministic rule-based classifier (simple point-scoring across the behavioral answers) so the flow never breaks.
  2. *(between the two AI calls, the backend runs `lib/sss.ts` and `lib/goalCalc.ts` — see §1 diagram — to compute the SSS estimate and the required-monthly-savings figure deterministically, using the risk classification from step 1 to pick a blended expected return rate)*
  3. **Recommendation narrative call** (second) — receives the user profile, the risk classification, the already-computed SSS and required-savings figures, and the full contents of `data/rates.json` as structured context. System prompt explicitly instructs: "Restate the SAVINGS_TARGET and GAP figures below exactly as given — do not recalculate them. Only reference rates/dividends provided in the CURRENT_RATES context below. Never state a percentage or rate not present there. Always include the disclaimer verbatim."
- **Grounding, not fetching or calculating:** the AI never calls a search tool, fetches live data, or performs the core financial math itself — it only reasons over and narrates numbers the backend already computed deterministically or loaded from `rates.json`. This is a deliberate choice from Step 7 of the idea validation: it trades a small amount of "freshness" (rates updated monthly, not live) for eliminating the biggest identified risk (AI hallucinating or misreporting a number that affects someone's real financial decision).
- Server-side guardrail after generation: check that the narrative's stated required-savings/gap figures match `lib/goalCalc.ts`'s output exactly, and regex/parse check for any numeric rate not found in `rates.json`; if either check fails, the response is rejected and regenerated once, then falls back to a template-based response using the raw calculated values if it fails twice.

### 2.4 Data Layer

**`data/rates.json`** (version-controlled, not a database table):
```json
{
  "last_reviewed": "2026-07-01",
  "vehicles": [
    { "id": "hysa", "category": "emergency_fund", "name": "High-yield digital bank savings (representative rate)", "rate_pct": 3.0, "rate_type": "variable_annual", "source": "https://...", "as_of": "2026-06-01" },
    { "id": "mp2", "category": "government_savings", "name": "Pag-IBIG MP2", "rate_pct": 7.12, "rate_type": "declared_annual_dividend", "source": "https://...", "as_of": "2026-02-27" },
    { "id": "uitf_conservative", "category": "uitf_money_market_or_bond", "name": "UITF – Money Market/Bond Fund (indicative)", "rate_pct": 3.5, "rate_type": "indicative_historical_avg", "source": "https://...", "as_of": "2026-06-01" },
    { "id": "uitf_moderate", "category": "uitf_balanced", "name": "UITF – Balanced Fund (indicative)", "rate_pct": 6.5, "rate_type": "indicative_historical_avg", "source": "https://...", "as_of": "2026-06-01" },
    { "id": "uitf_aggressive", "category": "uitf_equity", "name": "UITF – Equity Fund (indicative)", "rate_pct": 9.0, "rate_type": "indicative_historical_avg", "source": "https://...", "as_of": "2026-06-01" }
  ]
}
```
Kept as a flat JSON file in the repo rather than a Supabase table because: (a) it's small (5-6 entries), (b) it changes on a monthly cadence at most, (c) storing it in git gives a free, auditable history of every rate change, and (d) it avoids an extra DB round-trip on every plan generation.

**Supabase Postgres — `financial_plans` table:**
| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, FK → `auth.users` | |
| `age`, `monthly_income` | int/numeric | |
| `current_savings` | jsonb | `{emergency_fund, mp2, uitf}` |
| `target_goal` | jsonb | `{amount, target_age}` |
| `risk_answers` | jsonb | raw behavioral answers |
| `risk_profile` | text | enum, constrained via check constraint |
| `recommendation` | jsonb | full structured AI output (allocation %, narrative, sources) |
| `created_at`, `updated_at` | timestamptz | |

Row-level security (RLS) enabled: a user can only read/write their own row.

### 2.5 Auth Layer
Supabase Auth (email/password to start; OAuth optional stretch). Chosen over Clerk to keep the vendor count at one (DB + Auth in the same platform) — a direct application of Step 7's "keep MVP narrow" lesson.

## 3. Data Flow Summary
1. Client submits intake form → `/api/plan`.
2. Server validates → calls OpenAI to classify risk profile → runs `lib/sss.ts` and `lib/goalCalc.ts` (pure functions) to compute the SSS estimate and required monthly savings → loads `rates.json` → calls OpenAI again to generate the narrative + allocation, grounded in the already-computed numbers → guardrails the output (numbers must match, rates must exist in the source data) → returns structured JSON.
3. Client renders the result screen.
4. If signed in (or signs up now), client calls `/api/plan/save` to persist.
5. On return, `/plan/saved` loads via `/api/plan/latest` and pre-fills the form for regeneration.

## 4. Security & Secrets
- `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — all via environment variables (Vercel dashboard for production, `.env.local` for dev, gitignored). `.env.example` committed with empty placeholder values.
- Service-role Supabase key used only in server-side route handlers, never exposed to the client.
- All AI-facing routes rate-limited at a basic level (simple in-memory or Vercel Edge Config counter) to avoid runaway OpenAI cost from abuse — stretch goal, not a v1 blocker.

## 5. Deployment
- Vercel, connected to the GitHub repo's `main` branch for production deploys. Every PR gets an automatic preview deployment — test there before merging, never test directly in production.
- GitHub Actions workflow: on every PR, run lint + unit tests; on merge to `main`, Vercel handles the deploy (via its native GitHub integration) — Actions is the CI gate, Vercel is the CD mechanism.
- **Function timeout constraint (free tier):** on Vercel's free Hobby plan, the serverless function execution limit is a hard-capped 10 seconds — it is *not* configurable upward the way it is on the paid Pro plan (up to 300s). Since `/api/plan` makes two sequential OpenAI calls, this is a real risk of timing out on the free tier. Mitigations for v1: use a fast, cheap model (`gpt-4o-mini` — also far cheaper per call), keep prompts short, and test end-to-end response time early rather than assuming it'll fit. If it doesn't fit reliably, the fallback is to reduce to a single combined AI call (classify + narrate in one prompt) rather than two sequential ones.
- Environment parity: local dev uses `.env.local` with dev keys; PR previews use staging keys (Vercel preview environment variables); production uses production keys — configured separately in the Vercel dashboard, never shared across environments.

## 6. Monitoring & Analytics (Phase 4 requirement)
- **Vercel Analytics** (built-in, near-zero setup) for basic traffic/performance visibility — satisfies the assignment's "add basic monitoring or analytics" requirement with minimal effort.
- **Sentry** (optional, recommended if time allows) for error tracking with stack traces — particularly useful for catching AI-response-parsing failures (e.g., the guardrail in §2.3 rejecting a malformed model response) that would otherwise fail silently.
- At minimum for v1: enable Vercel Analytics and keep an eye on Vercel's function logs for OpenAI API errors — full Sentry integration can be a v2 addition if the timeline is tight.
