import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requestAccountDeletion } from "@/lib/operator-accounts";

export const maxDuration = 30;

async function getUser(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? "" };
}

/**
 * Mark the account for deletion. We don't hard-delete inline because:
 *  1. We need the audit trail (who requested, when, with which email).
 *  2. Cascade deletes across audiences/personas/simulations are non-trivial
 *     and risk wedging the worker if a row is mid-process.
 * The deletion job runs nightly via a separate batch worker.
 */
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await requestAccountDeletion(user.id);
  } catch (err) {
    console.error("requestAccountDeletion failed:", err);
    return Response.json(
      { error: "Could not record deletion request." },
      { status: 500 }
    );
  }

  // Best-effort: revoke active sessions immediately so the user is signed out
  // on the next request. If this fails the deletion request is still logged.
  try {
    const admin = supabaseAdmin();
    await admin.auth.admin.signOut(user.id, "global");
  } catch (err) {
    console.error("admin signOut failed:", err);
  }

  return Response.json({ ok: true });
}
