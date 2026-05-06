import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  CURRENT_CONSENT_VERSION,
  recordConsent,
} from "@/lib/operator-accounts";

export const maxDuration = 30;

async function getUser(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? "" };
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const input = body as Record<string, unknown> | null;
  const ownData = input?.own_data === true;
  const anonymizedProcessing = input?.anonymized_processing === true;
  const aggregatedLicensing = input?.aggregated_licensing === true;
  const version = input?.version;

  if (!ownData || !anonymizedProcessing || !aggregatedLicensing) {
    return Response.json(
      { error: "All three consents are required." },
      { status: 400 }
    );
  }

  if (typeof version !== "string" || version !== CURRENT_CONSENT_VERSION) {
    return Response.json(
      { error: "Consent version mismatch — please refresh and try again." },
      { status: 400 }
    );
  }

  try {
    await recordConsent(user.id, {
      ownData,
      anonymizedProcessing,
      aggregatedLicensing,
    });
  } catch (err) {
    console.error("recordConsent failed:", err);
    return Response.json(
      { error: "Could not record consent. Try again." },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, version: CURRENT_CONSENT_VERSION });
}
