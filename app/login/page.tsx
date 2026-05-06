import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  CURRENT_CONSENT_VERSION,
  getOperatorAccountByUserId,
} from "@/lib/operator-accounts";
import LoginClient from "./client";

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams: Promise<{ next?: string; mode?: string }>;
}

function safeNext(value: string | undefined): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/")) return "/dashboard";
  if (value.startsWith("//")) return "/dashboard";
  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const mode = params.mode === "signup" ? "signup" : "signin";

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    const account = await getOperatorAccountByUserId(user.id);
    if (account && !account.waitlist) {
      redirect(next);
    }
    if (account?.waitlist) {
      redirect("/waitlist/pending");
    }
  }

  return (
    <LoginClient
      initialMode={mode}
      next={next}
      consentVersion={CURRENT_CONSENT_VERSION}
    />
  );
}
