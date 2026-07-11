# CLAUDE.md

Guidance for any AI coding assistant (Claude Code, Cursor, etc.) working in this repository.

## Project

FreedomPath PH — an AI-powered web app that tells Filipino working professionals how much to save, where it should go (Emergency Fund/HYSA, Pag-IBIG MP2, UITF risk tier), and whether they're on track for their financial-freedom goal, including an SSS pension baseline estimate. See `PRD.md`, `spec.md`, and `Architecture_Notes.md` in the repo root for full context — read these before making non-trivial changes.

## Stack

Next.js 14 (App Router, TypeScript) · Tailwind CSS · Vercel AI SDK + OpenAI · Supabase (Postgres + Auth) · Deployed on Vercel · CI via GitHub Actions.

## Hard Rules — Do Not Violate

1. **Never hardcode secrets.** `OPENAI_API_KEY` and all Supabase keys come from environment variables only. Never write a literal API key into any file, test, or example. If you need a new env var, add it to `.env.example` with an empty value and document it.
2. **The AI never invents a rate.** Any recommendation-generation code must pass `data/rates.json` into the model's context and instruct it to cite only rates present there. Add/keep the server-side guardrail that rejects a generated response containing a numeric rate not found in `data/rates.json`.
3. **The disclaimer is not optional.** Every screen that shows an AI-generated recommendation must render the `<Disclaimer />` component. Don't let it be conditionally hidden or removed to "simplify" a UI pass.
4. **The SSS pension calculation and the required-monthly-savings calculation are deterministic, not AI-generated.** They live in `lib/sss.ts` (RA 11199 formula) and `lib/goalCalc.ts` (time-value-of-money: future value of current savings + required annuity payment to hit the target corpus) as pure functions. The AI's job is to narrate and contextualize these numbers, never to calculate them — the server-side guardrail should reject any AI response whose stated figures don't match these functions' output exactly.
5. **Stay inside v1 scope.** Do not add features listed as out-of-scope in `PRD.md` §4 (e.g., individual stock/bond trading, fund-name-level recommendations, push notifications, payment processing) without being explicitly asked. This project was deliberately scoped narrow after a validation exercise found over-engineering to be a real risk (see `Idea_Validation_Report.md` Step 7) — resist expanding it.
6. **Validate on both client and server.** Every form input needs a shared zod schema used in both the client component and the API route handler. Never trust client-side validation alone.

## Folder Structure (target)

```
/app                  — Next.js App Router pages
/app/api/plan          — route handlers (plan generation, save, latest)
/components             — shared UI (Disclaimer, forms, result screen)
/lib/sss.ts              — SSS pension formula (pure function, unit-tested)
/lib/goalCalc.ts          — required-monthly-savings calculation (pure function, unit-tested; AI narrates its output, never recalculates it)
/lib/schemas.ts          — shared zod validation schemas
/lib/ai.ts                — Vercel AI SDK calls (risk classification, recommendation generation) + guardrails
/data/rates.json           — manually-maintained current vehicle rates (update monthly, commit the change)
/tests                      — unit tests (minimum: SSS formula, allocation sums to 100, risk classifier fallback)
```

## Testing

Minimum 3 unit tests are a submission requirement (see assignment brief). At minimum, test: `lib/sss.ts` against known worked examples, that recommendation allocation percentages always sum to 100, and that the risk classifier returns a valid enum (including its fallback path when the AI response fails to parse).

## Commit Hygiene

This project needs a meaningful commit history (5+ commits) as a submission requirement. Prefer small, scoped commits over one large dump — e.g., separate commits for schema setup, SSS calculation, intake form, AI integration, save/revisit flow, and each monthly `data/rates.json` update.

## When Unsure

If a change would expand scope beyond `PRD.md` or `spec.md`, flag it explicitly rather than silently implementing it — this is a course project with a fixed submission deadline, and scope creep is the single biggest documented risk (Idea_Validation_Report.md, Step 7).
