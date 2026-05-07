import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  CURRENT_CONSENT_VERSION,
  ensureOperatorAccount,
  getOperatorAccountByUserId,
  hasCurrentConsent,
} from "@/lib/operator-accounts";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { listChatsForUser } from "@/lib/chats";
import ConsentGate from "./ConsentGate";
import DashboardClient, { type AudienceSummary } from "./client";
import type { ChatState, Platform, RunMode, VariantRun } from "./types";

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

  if (!hasCurrentConsent(account)) {
    return <ConsentGate consentVersion={CURRENT_CONSENT_VERSION} />;
  }

  const db = supabaseAdmin();
  const { data: audiences } = await db
    .from("audiences")
    .select("id, name, platform, status, row_count, created_at")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  const persistedChats = await listChatsForUser(user.id);
  const initialChats: ChatState[] = persistedChats.map((c) => ({
    id: c.id,
    title: c.title,
    audienceId: c.audience_id,
    audienceName: c.audience_name,
    audienceRowCount: c.audience_row_count,
    audiencePersonas: [],
    audienceLoading: false,
    audienceError: null,
    platform: (c.platform as Platform | null) ?? null,
    post: c.post,
    imageDataUrl: null,
    imageName: null,
    personaCap: c.audience_row_count ?? c.persona_cap,
    mode: (c.mode as RunMode | null) ?? null,
    variants: Array.isArray(c.variants) ? (c.variants as VariantRun[]) : [],
    variationsLoading: false,
    variationsError: null,
    runError: null,
    createdAt: new Date(c.created_at).getTime(),
  }));

  return (
    <DashboardClient
      email={user.email}
      audiences={(audiences ?? []) as AudienceSummary[]}
      initialChats={initialChats}
    />
  );
}
