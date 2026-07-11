import { NextRequest, NextResponse } from "next/server";
import { intakeFormSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/plan/save
 *
 * Requires auth (spec.md §2.6). Upserts the caller's plan — v1 keeps only
 * one active "current plan" per user, enforced by the `user_id` unique
 * constraint in supabase/migrations/0001_financial_plans.sql, so this is a
 * plain upsert rather than an insert-only history table.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in to save a plan." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { intake, result } = (body ?? {}) as { intake?: unknown; result?: unknown };

  // Re-validate server-side (CLAUDE.md hard rule #6) — never trust that the
  // client's copy of the intake payload is still valid.
  const parsedIntake = intakeFormSchema.safeParse(intake);
  if (!parsedIntake.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsedIntake.error.flatten() },
      { status: 400 }
    );
  }

  const resultObj = result as { riskProfile?: string } | undefined;
  const riskProfile = resultObj?.riskProfile;
  if (riskProfile !== "conservative" && riskProfile !== "moderate" && riskProfile !== "aggressive") {
    return NextResponse.json({ error: "Missing or invalid result payload" }, { status: 400 });
  }

  const { error } = await supabase.from("financial_plans").upsert(
    {
      user_id: user.id,
      intake_payload: parsedIntake.data,
      result_payload: result,
      risk_profile: riskProfile,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("[api/plan/save] Supabase upsert failed:", error);
    return NextResponse.json({ error: "Failed to save your plan. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
