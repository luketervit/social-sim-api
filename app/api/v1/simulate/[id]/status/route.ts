import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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
  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const db = supabaseAdmin();
  const { data: sim, error } = await db
    .from("simulations")
    .select(
      "id, audience_id, platform, input, status, progress_messages, thread, aggression_score, error_message, completed_at, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Status lookup failed:", error);
    return Response.json({ error: "Lookup failed." }, { status: 500 });
  }
  if (!sim) {
    return Response.json({ error: "Simulation not found." }, { status: 404 });
  }

  // Owner check via audience
  const { data: audience } = await db
    .from("audiences")
    .select("owner_user_id")
    .eq("id", sim.audience_id)
    .maybeSingle();
  if (!audience || audience.owner_user_id !== user.id) {
    return Response.json({ error: "Simulation not found." }, { status: 404 });
  }

  return Response.json({
    id: sim.id,
    status: sim.status,
    platform: sim.platform,
    input: sim.input,
    progressMessages: sim.progress_messages,
    thread: sim.thread ?? [],
    aggressionScore: sim.aggression_score,
    errorMessage: sim.error_message,
    completedAt: sim.completed_at,
    createdAt: sim.created_at,
  });
}
