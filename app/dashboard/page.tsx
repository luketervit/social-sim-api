import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  ensureOperatorAccount,
  getOperatorAccountByUserId,
} from "@/lib/operator-accounts";
import { supabaseAdmin } from "@/lib/supabase/admin";
import DashboardClient, { type AudienceSummary } from "./client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login?next=%2Fdashboard");
  }

  const account =
    (await getOperatorAccountByUserId(user.id)) ??
    (await ensureOperatorAccount(user.id, user.email));

  if (account.waitlist) {
    redirect("/waitlist/pending");
  }

  const db = supabaseAdmin();
  const { data: audiences } = await db
    .from("audiences")
    .select("id, name, platform, status, row_count, created_at")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <DashboardClient
      email={user.email}
      audiences={(audiences ?? []) as AudienceSummary[]}
    />
  );
}
