import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { sanitizeNextPath } from "@/lib/navigation";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = sanitizeNextPath(searchParams.get("next"));

  const response = NextResponse.redirect(`${origin}${next}`);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // If no explicit next was provided and this is a recovery session,
      // route to the password reset page instead of the dashboard.
      if (!searchParams.has("next") && data.session?.user?.recovery_sent_at) {
        const recoverySentAt = new Date(data.session.user.recovery_sent_at).getTime();
        const isRecentRecovery = Date.now() - recoverySentAt < 10 * 60 * 1000;
        if (isRecentRecovery) {
          const resetResponse = NextResponse.redirect(`${origin}/reset-password`);
          response.cookies.getAll().forEach((cookie) => {
            resetResponse.cookies.set(cookie.name, cookie.value);
          });
          return resetResponse;
        }
      }
      return response;
    }
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });

    if (!error) {
      return response;
    }
  }

  // Auth error — redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
