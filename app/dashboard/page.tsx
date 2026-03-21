import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ensureOperatorAccount } from "@/lib/operator-accounts";
import {
  getDailyPlaygroundQuotaForUser,
  listAudienceOptions,
  listSimulationsForUser,
  type SimulationShareEventRecord,
} from "@/lib/playground";
import { FREE_PLAYGROUND_SIMULATIONS_PER_DAY } from "@/lib/quotas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import DashboardClient from "./client";

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login");
  }

  await ensureOperatorAccount(user.id, user.email);
  const [playgroundQuota, simulations, audiences] = await Promise.all([
    getDailyPlaygroundQuotaForUser(user.id),
    listSimulationsForUser(user.id),
    listAudienceOptions(),
  ]);

  const simulationIds = simulations.map((s) => s.id);
  let shareEvents: SimulationShareEventRecord[] = [];

  if (simulationIds.length > 0) {
    const db = supabaseAdmin();
    const { data } = await db
      .from("simulation_share_events")
      .select("simulation_id, channel, share_text, destination, created_at")
      .in("simulation_id", simulationIds)
      .order("created_at", { ascending: false })
      .limit(500);

    shareEvents = (data ?? []) as SimulationShareEventRecord[];
  }

  const shareEventsBySimulation = new Map<string, SimulationShareEventRecord[]>();
  for (const event of shareEvents) {
    const existing = shareEventsBySimulation.get(event.simulation_id) ?? [];
    existing.push(event);
    shareEventsBySimulation.set(event.simulation_id, existing);
  }

  const hydratedSimulations = simulations.map((simulation) => {
    const simulationShareEvents = shareEventsBySimulation.get(simulation.id) ?? [];
    return {
      ...simulation,
      share_event_count: simulationShareEvents.length,
      recent_share_events: simulationShareEvents.slice(0, 4),
    };
  });

  return (
    <DashboardClient
      audiences={audiences}
      simulations={hydratedSimulations}
      dailyRunsLimit={FREE_PLAYGROUND_SIMULATIONS_PER_DAY}
      dailyRunsRemaining={playgroundQuota.remaining}
      userEmail={user.email}
    />
  );
}
