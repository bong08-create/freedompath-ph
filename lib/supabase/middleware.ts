import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request. Required whenever
 * Supabase SSR is used in Next.js — without this, sessions expire
 * unpredictably and Server Components can see stale/missing auth state.
 * Called from the root middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Don't crash the whole app when Supabase isn't configured yet — the
  // intake form and plan generation work without auth. Save/login still
  // needs these env vars filled in `.env.local`.
  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session if expired — required for Server Components, which
  // can't set cookies themselves.
  await supabase.auth.getUser();

  return response;
}
