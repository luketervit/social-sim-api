import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { randomBytes } from "crypto";
import { getOperatorAccountByUserId } from "@/lib/operator-accounts";
import { TRIAL_CREDITS } from "@/lib/credits";
import DashboardClient from "./client";
import WaitlistState from "./waitlist-state";

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const operatorAccount = await getOperatorAccountByUserId(user.id);

  if (!operatorAccount) {
    return (
      <div className="mx-auto max-w-[640px] px-6 pt-16 pb-24">
        <div className="panel" style={{ padding: 28 }}>
          <div className="mono-label">ACCOUNT_RECORD</div>
          <h1 style={{ fontSize: 32, marginTop: 14, color: "var(--text-primary)" }}>
            Account record missing
          </h1>
          <p
            style={{
              marginTop: 14,
              color: "var(--text-secondary)",
              lineHeight: 1.7,
            }}
          >
            This account does not have an `operator_accounts` record yet. Run
            the latest Supabase migration, then refresh this page.
          </p>
        </div>
      </div>
    );
  }

  if (operatorAccount.waitlist) {
    return (
      <WaitlistState
        email={operatorAccount.email || user.email || ""}
        joinedAt={operatorAccount.waitlist_joined_at}
      />
    );
  }

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
        credits: TRIAL_CREDITS,
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
