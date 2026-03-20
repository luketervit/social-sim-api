import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { CreateKeySchema } from "@/lib/schemas";
import { supabaseAdmin } from "@/lib/supabase/server";

// In-memory rate limit: max 3 key creations per IP per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

function normalizeEmail(email: string): string {
  const [local, domain] = email.toLowerCase().trim().split("@");
  // Strip +aliases (user+tag@gmail.com → user@gmail.com)
  const cleanLocal = local.split("+")[0];
  // Strip dots for gmail/googlemail (u.s.e.r@gmail.com → user@gmail.com)
  const gmailDomains = ["gmail.com", "googlemail.com"];
  const finalLocal = gmailDomains.includes(domain)
    ? cleanLocal.replace(/\./g, "")
    : cleanLocal;
  return `${finalLocal}@${domain}`;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";

  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: "Too many key requests. Try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateKeySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const email = normalizeEmail(parsed.data.email);
  const db = supabaseAdmin();

  // Check by normalized email
  const { data: existing } = await db
    .from("api_keys")
    .select("key")
    .eq("email", email)
    .single();

  if (existing) {
    return Response.json(
      { error: "An API key already exists for this email" },
      { status: 409 }
    );
  }

  const key = `ssim_${randomBytes(24).toString("hex")}`;

  const { error } = await db
    .from("api_keys")
    .insert({ key, email, credits: 100 });

  if (error) {
    return Response.json({ error: "Failed to create API key" }, { status: 500 });
  }

  return Response.json({ key, credits: 100 });
}
