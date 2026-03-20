"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function NavAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowser();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsLoggedIn(!!session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Don't render until we know auth state (prevents flash)
  if (isLoggedIn === null) {
    return <span className="nav-link" style={{ width: 80 }} />;
  }

  if (isLoggedIn) {
    return (
      <Link href="/dashboard" className="nav-link">
        Dashboard
      </Link>
    );
  }

  return (
    <Link href="/login" className="nav-link">
      Sign in
    </Link>
  );
}
