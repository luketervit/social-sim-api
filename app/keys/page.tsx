import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getOperatorAccountByUserId } from "@/lib/operator-accounts";
import KeysClient from "./keys-client";

export default async function KeysPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?mode=signin&next=%2Fkeys");
  }

  const operatorAccount = await getOperatorAccountByUserId(user.id);

  return (
    <KeysClient
      waitlisted={operatorAccount?.waitlist ?? true}
      waitlistJoinedAt={operatorAccount?.waitlist_joined_at ?? null}
      accessGrantedAt={operatorAccount?.access_granted_at ?? null}
    />
  );
}
