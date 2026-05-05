import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  ensureOperatorAccount,
  getOperatorAccountByUserId,
} from "@/lib/operator-accounts";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Persona } from "@/lib/schemas";
import DashboardClient, { type AudienceSummary } from "./client";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{ audience?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;

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

  const list = (audiences ?? []) as AudienceSummary[];
  const requestedId = params.audience?.trim();
  const selected =
    list.find((a) => a.id === requestedId && a.status === "ready") ??
    list.find((a) => a.status === "ready") ??
    null;

  let personas: Persona[] = [];
  let selectedPlatform: string | null = null;
  if (selected) {
    const { data: full } = await db
      .from("audiences")
      .select("personas, platform")
      .eq("id", selected.id)
      .maybeSingle();
    if (full?.personas && Array.isArray(full.personas)) {
      personas = full.personas as Persona[];
    }
    selectedPlatform =
      typeof full?.platform === "string" ? full.platform : selected.platform;
  }

  return (
    <DashboardClient
      email={user.email}
      audiences={list}
      selected={selected}
      personas={personas}
      selectedPlatform={selectedPlatform}
    />
  );
}
