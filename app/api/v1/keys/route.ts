import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Authenticate via session cookie
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();

  // Check if user already has a key
  const { data: existing } = await db
    .from("api_keys")
    .select("key, credits")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return Response.json(
      { error: "You already have an API key" },
      { status: 409 }
    );
  }

  const key = `ssim_${randomBytes(24).toString("hex")}`;

  const { error } = await db
    .from("api_keys")
    .insert({ key, email: user.email!, credits: 100, user_id: user.id });

  if (error) {
    return Response.json({ error: "Failed to create API key" }, { status: 500 });
  }

  return Response.json({ key, credits: 100 });
}

// GET: return current user's key info
export async function GET(request: NextRequest) {
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();

  const { data: keyRow } = await db
    .from("api_keys")
    .select("key, email, credits, created_at")
    .eq("user_id", user.id)
    .single();

  if (!keyRow) {
    return Response.json({ error: "No API key found" }, { status: 404 });
  }

  return Response.json(keyRow);
}
