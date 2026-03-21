import { supabaseAdmin } from "@/lib/supabase/admin";

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

export async function ensureOperatorAccount(userId: string, email: string) {
  const existing = await getOperatorAccountByUserId(userId);
  if (existing) {
    if (existing.email !== email) {
      const db = supabaseAdmin();
      const { error } = await db
        .from("operator_accounts")
        .update({ email })
        .eq("id", userId);

      if (error) {
        throw error;
      }

      return {
        ...existing,
        email,
      };
    }

    return existing;
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("operator_accounts")
    .insert({
      id: userId,
      email,
      waitlist: true,
      waitlist_joined_at: new Date().toISOString(),
    })
    .select("id, email, waitlist, waitlist_joined_at, access_granted_at")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to provision operator account");
  }

  return data as OperatorAccount;
}
