"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Save & Revisit Plan (spec.md §2.6). Unauthenticated users can still
 * generate a plan — this panel only prompts sign-up/sign-in when they
 * actually try to save it.
 */
export function SavePlanPanel({ intake, result }: { intake: unknown; result: unknown }) {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsSignedIn(!!data.user);
      setCheckingAuth(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/plan/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intake, result }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Couldn't save your plan. Please try again.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (checkingAuth) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Save This Plan</h2>

      {!isSignedIn && (
        <>
          <p className="mt-1 text-sm text-slate-600">
            Create a free account to save this plan and pick up right where you left off next time.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/auth/sign-up?redirectTo=/plan"
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Create account
            </Link>
            <Link
              href="/auth/sign-in?redirectTo=/plan"
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Sign in
            </Link>
          </div>
        </>
      )}

      {isSignedIn && !saved && (
        <>
          <p className="mt-1 text-sm text-slate-600">
            Save this plan so you can revisit and regenerate it later as your numbers change.
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Plan"}
          </button>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </>
      )}

      {isSignedIn && saved && (
        <p className="mt-1 text-sm text-emerald-700">
          Saved — visit{" "}
          <Link href="/plan/saved" className="font-medium underline">
            your saved plan
          </Link>{" "}
          any time to revisit it.
        </p>
      )}

      {isSignedIn && (
        <button
          onClick={async () => {
            await createClient().auth.signOut();
            window.location.reload();
          }}
          className="mt-4 block text-xs text-slate-400 underline hover:text-slate-600"
        >
          Sign out
        </button>
      )}
    </div>
  );
}
