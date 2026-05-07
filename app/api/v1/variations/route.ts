import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOperatorAccountByUserId } from "@/lib/operator-accounts";
import { generateViralIdeas } from "@/lib/simulation/ideate";

export const maxDuration = 60;

const ALLOWED_PLATFORMS = new Set<"twitter" | "reddit" | "slack" | "linkedin">([
  "twitter",
  "reddit",
  "slack",
  "linkedin",
]);
const MAX_INPUT = 2000;

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
  if (!user || !user.email) return null;
  return { id: user.id, email: user.email };
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getOperatorAccountByUserId(user.id);
  if (!account || account.waitlist) {
    return Response.json(
      { error: "Your account is still on the waitlist." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const payload = (body ?? {}) as {
    audienceId?: unknown;
    platform?: unknown;
    post?: unknown;
  };

  const audienceId =
    typeof payload.audienceId === "string" ? payload.audienceId.trim() : "";
  if (!audienceId) {
    return Response.json({ error: "audienceId required." }, { status: 400 });
  }

  const platformRaw =
    typeof payload.platform === "string" ? payload.platform.toLowerCase() : "";
  if (!ALLOWED_PLATFORMS.has(platformRaw as "twitter" | "reddit" | "slack" | "linkedin")) {
    return Response.json(
      { error: "platform must be twitter, linkedin, reddit, or slack." },
      { status: 400 }
    );
  }
  const platform = platformRaw as "twitter" | "reddit" | "slack" | "linkedin";

  const post = typeof payload.post === "string" ? payload.post.trim() : "";
  if (post.length === 0) {
    return Response.json({ error: "post required." }, { status: 400 });
  }
  if (post.length > MAX_INPUT) {
    return Response.json(
      { error: `Post must be under ${MAX_INPUT} characters.` },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();
  const { data: audience } = await db
    .from("audiences")
    .select("id, owner_user_id, name")
    .eq("id", audienceId)
    .maybeSingle();

  if (!audience || audience.owner_user_id !== user.id) {
    return Response.json({ error: "Audience not found." }, { status: 404 });
  }

  try {
    const ideas = await generateViralIdeas({
      topic: post,
      context: post,
      audienceId,
      platform,
    });

    return Response.json({ variations: ideas });
  } catch (err) {
    console.error("Variations generation failed:", err);
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not generate variations.",
      },
      { status: 500 }
    );
  }
}
