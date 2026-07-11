# spec.md — FreedomPath PH

**Stack:** Next.js 14 (App Router) + Tailwind CSS · Vercel AI SDK + OpenAI · Supabase (DB + Auth) · Deployed on Vercel · Built in Cursor.

This spec defines the v1 (MVP) build. Anything not listed here is out of scope — see PRD.md §4.

---

## 1. Core User Flow

1. User lands on the app, sees a short explainer + "Get My Plan" CTA (no login required to start).
2. **Intake form** collects profile + goal + risk-behavior answers.
3. AI layer classifies **risk profile** from the behavioral answers (§2.2).
4. System computes **SSS pension baseline** (deterministic formula, no AI — §2.3).
5. System computes **required monthly savings** to hit the goal (deterministic time-value-of-money calculation, no AI — §2.4), using the risk profile to pick a blended expected return rate from `data/rates.json`.
6. AI layer generates a **personalized narrative + allocation recommendation** (§2.5) that explains and contextualizes the numbers computed in steps 3-5 — it restates them, it does not calculate them.
7. Result screen shows: required monthly savings, current vs. required pace (with the ₱ gap), recommended % split across Emergency Fund/HYSA, Pag-IBIG MP2, and a UITF risk tier, SSS pension estimate, sources + last-checked dates, and the disclaimer.
8. User is prompted to sign up (Supabase Auth) to **save the plan**; returning signed-in users land on their saved plan and can regenerate it with updated numbers.

---

## 2. Feature Specs (Inputs → Outputs → Acceptance Criteria)

### 2.1 Goal & Profile Intake
- **Inputs:** age (number, 18-70), monthly income incl. side income (number, >0), current savings by category (emergency fund, MP2, UITF/other investments — numbers, ≥0, default 0), target goal (either a ₱ amount or "retirement by age X"), 4-5 risk-behavior questions (multiple choice, e.g. reaction to a hypothetical 15% portfolio drop).
- **Outputs:** a validated `UserProfile` object passed to the next step.
- **Acceptance criteria:**
  - Form blocks submission with inline errors on invalid age/income/negative savings.
  - All fields required except side-hustle income (optional, defaults 0).
  - Validated both client-side (immediate feedback) and server-side (API route, via zod schema) — never trust client-only validation.

### 2.2 AI Risk Profiling
- **Inputs:** the 4-5 behavioral answers from §2.1.
- **Outputs:** one of `conservative | moderate | aggressive`, plus a 1-2 sentence plain-language explanation of why.
- **Acceptance criteria:**
  - Always returns one of the three valid enum values — never empty/undefined; validate the AI's output server-side and fall back to a deterministic rule-based classifier if the AI response doesn't parse.
  - Same or near-identical inputs produce a consistent classification (temperature kept low for this call).

### 2.3 SSS Pension Baseline Estimate
- **Inputs:** current monthly salary/income (used to estimate Monthly Salary Credit), years of employment/contribution (user-provided estimate), member type (employed/self-employed/voluntary/OFW — affects MSC floor only, not the formula).
- **Outputs:** estimated monthly SSS pension (₱), using the higher of the RA 11199 formula variants, plus the ₱1,000 supplemental and 13th-month pension note.
- **Acceptance criteria:**
  - Pure deterministic function (`lib/sss.ts`), no AI involved — implements the official formula exactly, unit-tested against known worked examples.
  - Applies the ₱1,200 (≥10 CYS) / ₱2,400 (≥20 CYS) minimum pension floor correctly.
  - Flags clearly in the UI that this is an *estimate* based on self-reported inputs, not an official SSS computation.

### 2.4 Required Monthly Savings Calculation (deterministic — NOT AI-generated)
This is the actual answer to "how much do I need to save so I have enough by retirement age," and it must be pure math, not an AI-generated figure — the same treatment as §2.3, and for the same reason (Step 7 of the validation report: never let the AI be the source of a number this consequential).

- **Inputs:** current age, target retirement age (or target ₱ goal directly), current savings by category (§2.1), estimated SSS monthly pension (§2.3), a blended expected annual return rate (derived from the risk profile in §2.2 mapped to the corresponding rates in `data/rates.json` — e.g., conservative ≈ weighted toward HYSA/MP2 rates, aggressive ≈ weighted toward the equity UITF rate).
- **Calculation (`lib/goalCalc.ts`):**
  1. If the user gave a target retirement *age* rather than a ₱ goal, derive a target retirement corpus using a standard withdrawal-rate approach (e.g., desired monthly retirement income minus the SSS pension estimate, converted to a lump sum via a 4% annual withdrawal rate assumption), clearly labeled as an assumption in the UI.
  2. Compute the future value of the user's current savings at the blended expected return rate, compounded monthly, from now until the target age.
  3. Solve for the required level monthly contribution (future value of an ordinary annuity formula) such that: FV(current savings) + FV(monthly contributions) = target retirement corpus.
  4. Compare the required monthly contribution to the user's stated current monthly savings rate to produce the on-track/behind/ahead status and the ₱ gap.
- **Outputs:** required monthly savings figure (₱), target retirement corpus (₱), projected corpus at current savings rate (₱), on-track/behind/ahead status with ₱ gap.
- **Acceptance criteria:**
  - Pure deterministic function, unit-tested against at least 2 known worked examples (e.g., verified against a standard annuity/retirement calculator).
  - Never produces a negative required-savings figure; if the user is already ahead of pace, clearly state the surplus instead.
  - All assumptions used (expected return rate, withdrawal rate) are surfaced in the output, not hidden — so the user can see *why* the number is what it is.

### 2.5 AI Recommendation Narrative & Allocation
- **Inputs:** `UserProfile`, risk profile (§2.2), SSS pension estimate (§2.3), the deterministic required-savings output (§2.4), current `data/rates.json`.
- **Outputs:** a plain-language narrative wrapping the §2.4 numbers (the AI explains and contextualizes the required monthly savings and gap — it does not compute them); a % allocation across Emergency Fund/HYSA, Pag-IBIG MP2, and one UITF risk tier that **sums to 100%**; 2-3 concrete "levers" to close the gap if behind; source + last-checked date per vehicle; the standard disclaimer.
- **Acceptance criteria:**
  - The AI must restate the exact required-monthly-savings and gap figures computed in §2.4 — it is never asked to calculate them itself. Server-side check: the narrative's stated ₱ figures must match the §2.4 output exactly, or the response is rejected and regenerated.
  - Every rate/dividend figure quoted in the output must trace back to an entry in `data/rates.json` — the AI is given this file as context and instructed never to state a rate not present in it. Server-side check: reject/regenerate if the response contains a numeric rate not found in the provided data.
  - Allocation percentages sum to exactly 100.
  - Disclaimer text ("This is educational information, not licensed financial or investment advice...") is always present in the output, appended server-side if the model omits it — never solely relied upon from the prompt.

### 2.6 Save & Revisit Plan
- **Inputs:** the completed plan (profile + risk profile + recommendation output) + authenticated user ID.
- **Outputs:** a persisted row in Supabase; on return visit, the signed-in user's most recent plan is loaded and pre-fills the form for easy regeneration.
- **Acceptance criteria:**
  - Unauthenticated users can still generate a plan; save action prompts sign-up/sign-in first.
  - Only one active "current plan" per user in v1 (no plan history/versioning yet — v2).

---

## 3. Non-Functional Requirements

- **No hardcoded secrets.** `OPENAI_API_KEY` and Supabase keys live only in environment variables (Vercel project settings + local `.env.local`, gitignored). A committed `.env.example` documents required variable names with empty values.
- **Input validation** on every form and API route via a shared zod schema (client + server).
- **Disclaimer** ("educational, not licensed financial advice") rendered on every recommendation screen, not just once.
- **Testing:** minimum 3 unit tests for v1 — SSS formula correctness, allocation percentages sum to 100, risk classifier returns a valid enum with a safe fallback.
- **AI grounding:** the model is never the source of truth for a rate/dividend number — `data/rates.json` is, and is passed into the prompt as context on every call.

---

## 4. Explicitly Out of Scope for v1
See PRD.md §4. Notably: no fund/product-name-level recommendations, no push/email alerts, no plan history, no individual stock/bond trading, no payment processing.
