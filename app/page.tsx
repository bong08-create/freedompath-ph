import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        FreedomPath PH
      </h1>
      <p className="mt-4 text-lg text-slate-600">
        How much should you save, where should it go given your risk
        tolerance, and are you actually on track for financial freedom?
        Grounded in real, current Philippine investment vehicle rates.
      </p>
      <Link
        href="/plan"
        className="mt-8 rounded-lg bg-slate-900 px-6 py-3 text-base font-semibold text-white transition hover:bg-slate-700"
      >
        Get My Plan
      </Link>
      <p className="mt-4 text-sm text-slate-400">
        No sign-up required to try it. Educational information only — not
        licensed financial advice.
      </p>
    </main>
  );
}
