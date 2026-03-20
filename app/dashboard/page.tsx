import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOperatorAccountByUserId } from "@/lib/operator-accounts";
import DashboardClient from "./client";
import WaitlistState from "./waitlist-state";

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  const { data: apiKeys, error } = await db
    .from("api_keys")
    .select("key, email, credits, total_tokens_used, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="pt-16">
        <p style={{ color: "#f87171" }}>Failed to load API keys. Please try again.</p>
      </div>
    );
  }

  return <DashboardClient apiKeys={apiKeys ?? []} userEmail={user.email!} />;
}
