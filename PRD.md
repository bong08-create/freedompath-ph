# Product Requirements Document

**Product:** FreedomPath PH *(working title — easy to rename later)*
**One-liner:** An AI-powered web app that tells Filipino professionals how much to save, where it should go, and whether they're on track for financial freedom — grounded in real, current PH investment data.

---

## 1. Problem Statement

Filipino professionals have no personalized answer to three questions: how much to save monthly, where it should go given risk tolerance, and whether their trajectory is closing the gap. 80% report they aren't retirement-ready and only 13.4% have a dedicated plan. Existing options are generic calculators/blogs (impersonal) or human advisors (expensive, gated) — nothing offers personalized, goal-based, AI-driven guidance that's instant and affordable.

## 2. Target Users

Primary persona: **"Anna," 26-35**, corporate/BPO/tech in Metro Manila/Cebu/Davao, ₱35K-90K/month, often blending a main job with side-hustle income. Money is scattered across 2-4 apps with no view of whether she's on track. She often supports parents/siblings too, which generic US-centric FIRE tools ignore — she's asking not just "how do I maximize returns" but "am I saving at a sustainable pace."

## 3. Core Features (MVP Scope)

*Full inputs/outputs and detailed acceptance criteria for each feature live in `spec.md` §2 — the italicized lines below are the PRD-level pass/fail bar.*

1. **Goal & Profile Intake** — age, income, savings by category, target goal, 4-5 risk questions. *Acceptance: blocked with inline errors on invalid fields; validated client + server.*
2. **AI Risk Profiling** — classifies risk tolerance from behavioral answers with a plain-language why. *Acceptance: always returns `conservative | moderate | aggressive`, with a rule-based fallback on parse failure.*
3. **Gap Analysis & Allocation Recommendation** — required savings vs. trajectory, plus a split across emergency fund/HYSA, **Pag-IBIG MP2** (~7.12% dividend), and a **UITF risk tier**. *Acceptance: allocation sums to 100%; rates trace to `data/rates.json`; disclaimer always present.*
4. **SSS Pension Baseline Estimate** — public formula estimates monthly payout. *Acceptance: deterministic, unit-tested — never AI-generated.*
5. **Save & Revisit Plan** — free account to save/return to a plan. *Acceptance: unauth users can generate a plan; saving prompts sign-up; returning users land on their saved plan, never blank.*

## 4. Out of Scope (v1)

- No custody of funds or direct investment execution — advisory only.
- No naming specific funds or individual stock/bond picks — category-level only.
- No push/email notifications or rate-change alerts (v2).
- No full 7-vehicle coverage — v1 is HYSA + MP2 + UITF tier + SSS baseline; RTBs, direct stocks, and PERA are v2.
- No multi-user/family accounts, no human-advisor handoff.
- No real payment processing (assignment constraint) — pricing UI can be mocked.

## 5. Success Metrics

- **Activation:** >50% of intake starters complete it.
- **Retention proxy:** % who revisit their saved plan within 30-90 days — the top metric (validation Step 7's biggest flagged risk).
- **Qualitative signal:** % of testers who say the plan gave a clear next step.
- **Distribution (stretch):** engagement on the standalone SSS estimator.

## 6. Open Questions

- **Rate sourcing:** resolved — a manually-curated `data/rates.json`; the AI never invents a rate.
- **Educational vs. licensed advice:** partially resolved (not legal advice) — RA 11765 adviser status turns on *compensation*; v1 is free (full reasoning in README).
- **SSS edge cases:** resolved — RA 11199 §12 applies uniformly; only contribution splits/MSC floors differ.
- **Retention hook beyond v1:** open — a monthly email digest is the recommended v2 addition (tracked as a GitHub issue).
