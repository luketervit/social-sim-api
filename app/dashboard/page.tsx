import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { randomBytes } from "crypto";
import DashboardClient from "./client";

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const db = supabaseAdmin();

  // Get existing key for this user
  let { data: keyRow } = await db
    .from("api_keys")
    .select("key, email, credits, created_at")
    .eq("user_id", user.id)
    .single();

  // Auto-create a free trial key on first visit
  if (!keyRow) {
    const key = `ssim_${randomBytes(24).toString("hex")}`;
    const { data: newKey, error } = await db
      .from("api_keys")
      .insert({
        key,
        email: user.email!,
        credits: 100,
        user_id: user.id,
      })
      .select("key, email, credits, created_at")
      .single();

    if (error) {
      return (
        <div className="pt-16">
          <p style={{ color: "#f87171" }}>Failed to create API key. Please try again.</p>
        </div>
      );
    }

    keyRow = newKey;
  }

  return (
    <DashboardClient
      apiKey={keyRow!.key}
      email={keyRow!.email}
      credits={keyRow!.credits}
      createdAt={keyRow!.created_at}
      userEmail={user.email!}
    />
  );
}
