import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export { supabaseAdmin } from "./admin";

// Per-request client with user's auth context (for Server Components / Route Handlers)
export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore — called from a Server Component where cookies are read-only
          }
        },
      },
    }
  );
}
