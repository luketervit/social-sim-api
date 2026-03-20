import { supabaseAdmin } from "@/lib/supabase/server";

export interface OperatorAccount {
  id: string;
  email: string;
  waitlist: boolean;
  waitlist_joined_at: string;
  access_granted_at: string | null;
}

export async function getOperatorAccountByUserId(userId: string) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("operator_accounts")
    .select("id, email, waitlist, waitlist_joined_at, access_granted_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as OperatorAccount | null;
}
