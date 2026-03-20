import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOperatorAccountByUserId } from "@/lib/operator-accounts";
import { TRIAL_CREDITS } from "@/lib/credits";

async function getAuthenticatedUser(request: NextRequest) {
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

  if (!user) {
    return { errorResponse: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const operatorAccount = await getOperatorAccountByUserId(user.id);

  if (!operatorAccount) {
    return {
      errorResponse: Response.json(
        { error: "Operator account not provisioned" },
        { status: 412 }
      ),
    };
  }

  if (operatorAccount.waitlist) {
    return {
      errorResponse: Response.json(
        { error: "Closed beta access is still pending approval" },
        { status: 403 }
      ),
    };
  }

  return { user };
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const db = supabaseAdmin();
  const key = `ssim_${randomBytes(24).toString("hex")}`;

  const { data: keyRow, error } = await db
    .from("api_keys")
    .insert({
      key,
      email: auth.user.email!,
      credits: TRIAL_CREDITS,
      user_id: auth.user.id,
    })
    .select("key, email, credits, total_tokens_used, created_at")
    .single();

  if (error || !keyRow) {
    return Response.json({ error: "Failed to create API key" }, { status: 500 });
  }

  return Response.json(keyRow, { status: 201 });
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const db = supabaseAdmin();
  const { data: keyRows, error } = await db
    .from("api_keys")
    .select("key, email, credits, total_tokens_used, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: "Failed to load API keys" }, { status: 500 });
  }

  return Response.json({ keys: keyRows ?? [] });
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const key = typeof body === "object" && body !== null && "key" in body ? body.key : undefined;
  if (typeof key !== "string" || key.length === 0) {
    return Response.json({ error: "API key is required" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("api_keys")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("key", key)
    .select("key")
    .maybeSingle();

  if (error) {
    return Response.json({ error: "Failed to delete API key" }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "API key not found" }, { status: 404 });
  }

  return Response.json({ deleted: true, key });
}
