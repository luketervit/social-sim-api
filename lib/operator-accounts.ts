import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Bump this whenever the consent copy in `app/login/client.tsx`,
 * `/terms`, or `/privacy` materially changes. Stored alongside the
 * timestamp so we can re-prompt accounts that pre-date the change.
 */
export const CURRENT_CONSENT_VERSION = "2026-05-06";

export interface OperatorAccount {
  id: string;
  email: string;
  waitlist: boolean;
  waitlist_joined_at: string;
  access_granted_at: string | null;
  consent_version: string | null;
  consent_accepted_at: string | null;
  consent_own_data: boolean;
  consent_anonymized_processing: boolean;
  consent_aggregated_licensing: boolean;
  deletion_requested_at: string | null;
}

const SELECT_COLUMNS =
  "id, email, waitlist, waitlist_joined_at, access_granted_at, " +
  "consent_version, consent_accepted_at, consent_own_data, " +
  "consent_anonymized_processing, consent_aggregated_licensing, " +
  "deletion_requested_at";

export async function getOperatorAccountByUserId(userId: string) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("operator_accounts")
    .select(SELECT_COLUMNS)
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
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to provision operator account");
  }

  return data as unknown as OperatorAccount;
}

export interface ConsentInput {
  ownData: boolean;
  anonymizedProcessing: boolean;
  aggregatedLicensing: boolean;
}

export async function recordConsent(
  userId: string,
  input: ConsentInput
): Promise<void> {
  if (
    !input.ownData ||
    !input.anonymizedProcessing ||
    !input.aggregatedLicensing
  ) {
    throw new Error("All three consent checkboxes must be accepted.");
  }

  const db = supabaseAdmin();
  const { error } = await db
    .from("operator_accounts")
    .update({
      consent_version: CURRENT_CONSENT_VERSION,
      consent_accepted_at: new Date().toISOString(),
      consent_own_data: true,
      consent_anonymized_processing: true,
      consent_aggregated_licensing: true,
    })
    .eq("id", userId);

  if (error) {
    throw error;
  }
}

export function hasCurrentConsent(account: OperatorAccount | null): boolean {
  if (!account) return false;
  if (!account.consent_accepted_at) return false;
  if (account.consent_version !== CURRENT_CONSENT_VERSION) return false;
  return (
    account.consent_own_data &&
    account.consent_anonymized_processing &&
    account.consent_aggregated_licensing
  );
}

export async function requestAccountDeletion(userId: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("operator_accounts")
    .update({
      deletion_requested_at: new Date().toISOString(),
      waitlist: true,
    })
    .eq("id", userId);

  if (error) {
    throw error;
  }
}
