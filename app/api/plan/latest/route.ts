import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/plan/latest
 *
 * Requires auth. Returns the signed-in user's saved plan (intake + result),
 * or 404 if they haven't saved one yet. Used by /plan/saved to pre-fill the
 * form and re-render the last result without recomputing anything.
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("financial_plans")
    .select("intake_payload, result_payload, risk_profile, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[api/plan/latest] Supabase query failed:", error);
    return NextResponse.json({ error: "Failed to load your saved plan." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "No saved plan yet." }, { status: 404 });
  }

  return NextResponse.json(data);
}
