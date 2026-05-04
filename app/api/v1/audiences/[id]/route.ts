import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
  const { data, error } = await db
    .from("audiences")
    .select(
      "id, name, platform, status, row_count, error_message, metadata, created_at, processed_at, personas"
    )
    .eq("id", id)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (error) {
    return Response.json({ error: "Failed to load audience." }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "Audience not found." }, { status: 404 });
  }

  // Trim personas in the status response to keep payloads small. Full persona
  // JSON is only loaded by the simulation routes.
  const personasPreview = Array.isArray(data.personas)
    ? data.personas.slice(0, 6)
    : [];

  return Response.json({
    id: data.id,
    name: data.name,
    platform: data.platform,
    status: data.status,
    row_count: data.row_count,
    error: data.error_message,
    metadata: data.metadata,
    created_at: data.created_at,
    processed_at: data.processed_at,
    personas_preview: personasPreview,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("audiences")
    .delete()
    .eq("id", id)
    .eq("owner_user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return Response.json({ error: "Failed to delete audience." }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "Audience not found." }, { status: 404 });
  }

  return Response.json({ deleted: true, id });
}
