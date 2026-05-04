import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ensureOperatorAccount } from "@/lib/operator-accounts";
import { supabaseAdmin } from "@/lib/supabase/admin";
import AudiencesClient from "./client";

export const dynamic = "force-dynamic";

interface AudienceRow {
  id: string;
  name: string;
  platform: string | null;
  status: string;
  row_count: number | null;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

export default async function AudiencesPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login?next=%2Faudiences");
  }

  await ensureOperatorAccount(user.id, user.email);

  const db = supabaseAdmin();
  const { data } = await db
    .from("audiences")
    .select(
      "id, name, platform, status, row_count, error_message, created_at, processed_at"
    )
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  return <AudiencesClient initialAudiences={(data ?? []) as AudienceRow[]} />;
}
