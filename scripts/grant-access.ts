import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const emails = process.argv.slice(2);
if (emails.length === 0) {
  console.error("Usage: npm run grant -- email@one.com [email@two.com ...]");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function grant(email: string) {
  const { data: account, error: lookupError } = await supabase
    .from("operator_accounts")
    .select("id, email, waitlist, access_granted_at")
    .ilike("email", email)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }
  if (!account) {
    throw new Error(`No operator_account found for ${email}`);
  }

  if (account.waitlist) {
    const { error: updateError } = await supabase
      .from("operator_accounts")
      .update({
        waitlist: false,
        access_granted_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    if (updateError) {
      throw updateError;
    }
  }

  // Revoke any stale sessions so access changes take effect cleanly.
  const { error: signOutError } = await supabase.auth.admin.signOut(account.id);
  if (signOutError) {
    console.warn(
      `  · could not revoke existing sessions for ${account.email}: ${signOutError.message}`
    );
  }

  console.log(`✓ ${account.email} — access granted, sessions revoked`);
}

(async () => {
  for (const email of emails) {
    try {
      await grant(email);
    } catch (err) {
      console.error(`✗ ${email} —`, err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  }
})();
