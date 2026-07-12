# Product Requirements Document

**Product:** FreedomPath PH *(working title — easy to rename later)*
**One-liner:** An AI-powered web app that tells Filipino working professionals how much they need to save, where it should go given their risk profile, and whether they're actually on track for financial freedom — grounded in real, current PH investment vehicle data.

---

## 1. Problem Statement

Most Filipino working professionals want "financial freedom" but have no personalized answer to three connected questions: how much to save monthly to reach a real goal, where that money should go given their risk tolerance, and whether their current trajectory is actually closing the gap. 80% of Filipinos report they are not retirement-ready, only 13.4% have a dedicated retirement plan, and genuine voluntary investing (excluding mandatory SSS/GSIS) sits at just ~10% of adults. Existing options sit at two extremes: generic retirement calculators and static rate blogs (free but impersonal), or human financial advisors like IFE Management (personalized but expensive, application-gated, and capacity-limited). Nothing occupies the middle: personalized, goal-based, AI-driven guidance that's instant and affordable.

## 2. Target Users

Primary persona: **"Anna," 26-35**, working in corporate/BPO/tech in Metro Manila/Cebu/Davao, ₱35K-90K/month, often blending a main job with freelance/side-hustle income. Money is scattered across 2-4 apps with no single view of whether she's on track. She's often also financially supporting parents/siblings, which most generic (usually US-centric) FIRE tools ignore. She's not only asking "how do I maximize returns" — she's also asking "am I saving at a sustainable, sufficient pace."

## 3. Core Features (MVP Scope)

*Full inputs/outputs and detailed acceptance criteria for each feature live in `spec.md` §2 — the one-liners below are the testable pass/fail bar for each feature at the PRD level.*

1. **Goal & Profile Intake** — short, conversational form: age, income, current savings/investments by category, target goal (amount or retirement age), and 4-5 behavioral risk questions.
   *Acceptance criteria: submission is blocked with inline errors on invalid/missing required fields, validated on both client and server.*
2. **AI Risk Profiling** — classifies risk tolerance from behavioral answers (not a generic quiz label) with a plain-language explanation of why.
   *Acceptance criteria: always returns one of `conservative | moderate | aggressive`, with a deterministic rule-based fallback if the AI response fails to parse.*
3. **Personalized Gap Analysis & Allocation Recommendation** — AI-generated: required monthly savings vs. current trajectory, plus a risk-appropriate split across three vehicle categories: (a) emergency fund/HYSA, (b) **Pag-IBIG MP2** (tax-free, government-backed, 5-year term, ~7.12% 2025 dividend — hugely popular in the Philippines and the single vehicle mentioned directly in our own validation evidence from r/phinvest), and (c) a **UITF risk tier** (money market/bond fund for conservative profiles, balanced fund for moderate, equity fund for aggressive) — giving real bond and stock market exposure through professionally-managed fund tiers rather than picking individual securities. Grounded in a maintained, timestamped rate/dividend/fund-performance reference table (not the model's memory) — with visible sources, "last updated" date, and a clear "educational, not licensed financial advice" disclaimer.
   *Acceptance criteria: allocation percentages always sum to exactly 100; every rate cited must exist in `data/rates.json` or the response is rejected/regenerated; the disclaimer is always present.*
4. **SSS Pension Baseline Estimate** — uses the public SSS pension formula to show an estimated monthly SSS payout, layered into the gap analysis (validated as a sharp, standalone hook in idea validation).
   *Acceptance criteria: pure deterministic function matching the RA 11199 formula, unit-tested against known worked examples — never AI-generated.*
5. **Save & Revisit Plan** — lightweight account to save and return to update a plan, creating a built-in reason to come back without requiring full notification infrastructure in v1.
   *Acceptance criteria: unauthenticated users can still generate a plan; saving prompts sign-up/sign-in first; a returning signed-in user lands on their saved plan, never a blank form.*

## 4. Out of Scope (v1)

- No custody of funds or direct investment execution — advisory/informational only.
- No naming specific proprietary funds/products (e.g. no "Bank X's UITF" by name) or individual stock/bond picks — recommendations stay at the risk-tier/category level (regulatory risk mitigation).
- No push/email notifications or automated rate-change alerts (planned v2).
- No full 7-vehicle coverage — v1 covers emergency fund/HYSA + Pag-IBIG MP2 + UITF risk tier (covering bond and equity exposure) + SSS baseline; individual RTBs/T-bills, direct stock trading, and PERA-administrator comparison are v2.
- No multi-user/family accounts, no human-advisor handoff/marketplace.
- No real payment processing (per assignment constraint) — pricing/paywall UI can be mocked, not functional.

## 5. Success Metrics

- **Activation:** >50% of users who start the intake flow complete it.
- **Retention proxy:** % of users who return to revisit/update their saved plan within 30-90 days — the single most important metric, since Step 7 of validation identified weak retention (Mint.com's failure mode) as the biggest risk to this idea.
- **Qualitative signal:** in user testing, % who say the plan gave them a clear, specific next step (not just information).
- **Distribution signal (stretch):** shares/engagement on the standalone SSS estimator, tested as a cheap acquisition hook during validation.

## 6. Open Questions

- ~~How to source and keep rate data current~~ — **Resolved:** a small, manually-curated, version-controlled data file (`data/rates.json`: vehicle, rate/dividend, effective date, source URL, last-checked date), updated monthly by hand. The AI reasons over this trusted data rather than inventing or live-fetching rates itself — satisfies Step 7's "don't let the AI hallucinate numbers" mitigation with zero scraping/API infrastructure. SSS formula/brackets are hardcoded as a calculation function since they rarely change.
- ~~Where exactly the line sits between "educational allocation guidance" and "investment advice" requiring registration~~ — **Partially resolved via research (not legal advice):** under the SEC's Financial Products and Services Consumer Protection Act (RA 11765) IRR, "Investment Adviser" is defined as anyone who, **for compensation**, advises on the value or advisability of investing in specific investment products, or issues analyses/reports on investment products. "For compensation" is the key trigger. Since v1 has no real payment processing (already an assignment constraint — see §4) and won't charge users, this meaningfully reduces registration exposure for the submitted project. Named professional exemptions exist (lawyers, accountants, teachers, engineers whose advice is incidental to their main practice) but no explicit "free educational content" exemption was found in public search. **Action taken:** keep v1 free, keep language educational/general rather than prescriptive ("here's what this typically looks like" rather than "you should buy X"), and flag in the README/reflection that a real legal consult would be required before any future paid/commercial launch — an honest, defensible scope boundary for a course project, not a loophole.
- ~~Whether the public SSS formula holds up for edge cases (self-employed/voluntary members, OFWs)~~ — **Resolved:** the pension formula (RA 11199 §12, based on AMSC × CYS) applies uniformly to all member types; only contribution inputs differ (employed splits 10%/5% with employer, self-employed/voluntary/OFW pay the full 15%; MSC floors vary slightly by type). All types need 120 contributions before the retirement semester to qualify. V1 can support all member types.
- What the real retention hook should look like post-MVP (email digest, in-app reminder, true push notification) — **intentionally left open, not blocking v1 build**, since the Save & Revisit Plan feature (§3.5) already gives v1 a reason to return without needing this infrastructure. Lightweight recommendation for whenever v2 planning starts: a monthly email digest (Supabase + a scheduled function) is the simplest option, avoiding push notification infrastructure entirely.
