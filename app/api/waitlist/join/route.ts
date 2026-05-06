import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureOperatorAccount } from "@/lib/operator-accounts";

export const runtime = "nodejs";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email =
    typeof (body as { email?: unknown })?.email === "string"
      ? (body as { email: string }).email.trim().toLowerCase()
      : "";
  const password =
    typeof (body as { password?: unknown })?.password === "string"
      ? (body as { password: string }).password
      : "";

  if (!email || email.length > 320 || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (password.length < PASSWORD_MIN) {
    return NextResponse.json(
      { error: `Password must be at least ${PASSWORD_MIN} characters.` },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  // Look up any existing auth user for this email so we don't double-create.
  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1,
    // listUsers doesn't support a server-side email filter in supabase-js, so
    // we filter client-side. Email volume here is small.
  });

  if (listError) {
    console.error("waitlist list users failed", listError);
    return NextResponse.json(
      { error: "Couldn't reach the waitlist right now." },
      { status: 502 }
    );
  }

  let userId: string | null =
    list.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;

  // listUsers only returned page 1; if not found there, do a targeted lookup
  // by attempting to create. Duplicate-email errors are how we discover an
  // existing user reliably.
  if (!userId) {
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError) {
      const status = (createError as { status?: number }).status;
      const message = createError.message ?? "";
      const alreadyExists =
        status === 422 ||
        /already\s+registered|already\s+exists|duplicate/i.test(message);

      if (!alreadyExists) {
        console.error("waitlist createUser failed", createError);
        return NextResponse.json(
          { error: "Couldn't add you to the waitlist." },
          { status: 502 }
        );
      }
      return NextResponse.json(
        {
          error:
            "This email already has an account. Sign in instead, or use reset password if you joined under the old waitlist flow.",
        },
        { status: 409 }
      );
    } else {
      userId = created.user?.id ?? null;
    }
  }

  if (!userId) {
    return NextResponse.json(
      { error: "Couldn't add you to the waitlist." },
      { status: 502 }
    );
  }

  try {
    await ensureOperatorAccount(userId, email);
  } catch (err) {
    console.error("waitlist ensureOperatorAccount failed", err);
    return NextResponse.json(
      { error: "Couldn't add you to the waitlist." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, email });
}
