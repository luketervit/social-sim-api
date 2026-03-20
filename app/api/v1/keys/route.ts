import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { CreateKeySchema } from "@/lib/schemas";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateKeySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email } = parsed.data;
  const db = supabaseAdmin();

  const { data: existing } = await db
    .from("api_keys")
    .select("key")
    .eq("email", email)
    .single();

  if (existing) {
    return Response.json(
      { error: "An API key already exists for this email" },
      { status: 409 }
    );
  }

  const key = `ssim_${randomBytes(24).toString("hex")}`;

  const { error } = await db
    .from("api_keys")
    .insert({ key, email, credits: 100 });

  if (error) {
    return Response.json({ error: "Failed to create API key" }, { status: 500 });
  }

  return Response.json({ key, credits: 100 });
}
