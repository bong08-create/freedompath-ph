import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlanFlow } from "@/components/PlanFlow";
import type { IntakeFormValues } from "@/lib/schemas";
import type { PlanResult } from "@/components/ResultScreen";

/**
 * /plan/saved — spec.md §2.6: "returning signed-in users land on their saved
 * plan and can regenerate it with updated numbers." Server component so the
 * saved plan loads directly from Supabase with no extra client-side fetch.
 */
export default async function SavedPlanPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?redirectTo=/plan/saved");
  }

  const { data, error } = await supabase
    .from("financial_plans")
    .select("intake_payload, result_payload")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[app/plan/saved] Supabase query failed:", error);
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">No saved plan yet</h1>
        <p className="mt-3 text-sm text-slate-600">
          Generate a plan and save it to see it here next time.
        </p>
        <Link
          href="/plan"
          className="mt-6 inline-block rounded-lg bg-slate-900 px-6 py-3 text-base font-semibold text-white transition hover:bg-slate-700"
        >
          Get My Plan
        </Link>
      </main>
    );
  }

  return (
    <PlanFlow
      initialIntake={data.intake_payload as IntakeFormValues}
      initialResult={data.result_payload as PlanResult}
    />
  );
}
