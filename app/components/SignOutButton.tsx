"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function SignOutButton({
  className = "btn-secondary",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button onClick={handleSignOut} className={className} style={style}>
      Sign out
    </button>
  );
}
