import { notFound, redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ensureOperatorAccount } from "@/lib/operator-accounts";
import {
  canAccessOperatorPersonaInsights,
  loadOperatorPersonaInsights,
} from "@/lib/operator-persona-insights";
import DashboardIntelClient from "./client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Persona Intelligence — Atharias",
  description: "Operator-only view over aggregated uploaded persona data.",
};

export default async function DashboardIntelPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login?next=%2Fdashboard%2Fintel");
  }

  await ensureOperatorAccount(user.id, user.email);

  if (!canAccessOperatorPersonaInsights(user.email)) {
    notFound();
  }

  const insights = await loadOperatorPersonaInsights();

  return <DashboardIntelClient insights={insights} userEmail={user.email} />;
}
