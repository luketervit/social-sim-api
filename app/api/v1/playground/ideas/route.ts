import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { ensureOperatorAccount } from "@/lib/playground";
import {
  FREE_PLAYGROUND_IDEA_REQUESTS_PER_DAY,
  QUOTA_BUCKETS,
  consumeDailyQuota,
  refundDailyQuota,
} from "@/lib/quotas";
import { generateViralIdeas } from "@/lib/simulation/ideate";

const IdeaRequestSchema = z.object({
  topic: z.string().trim().min(3).max(160),
  context: z.string().trim().max(1000).optional().or(z.literal("")),
  brand: z.string().trim().max(120).optional().or(z.literal("")),
  audience_id: z.string().trim().min(1),
  platform: z.enum(["twitter", "reddit", "slack"]),
});

async function getAuthenticatedUser(request: NextRequest) {
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

  if (!user || !user.email) {
    return null;
  }

  await ensureOperatorAccount(user.id, user.email);
  return user;
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = IdeaRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const quota = await consumeDailyQuota(
    user.id,
    QUOTA_BUCKETS.playgroundIdea,
    FREE_PLAYGROUND_IDEA_REQUESTS_PER_DAY
  );

  if (!quota.allowed) {
    return Response.json(
      {
        error: "Daily idea-generation limit reached. Try again tomorrow.",
        daily_limit: FREE_PLAYGROUND_IDEA_REQUESTS_PER_DAY,
        remaining_today: quota.remaining,
        usage_date: quota.usage_date,
      },
      { status: 429 }
    );
  }

  try {
    const ideas = await generateViralIdeas({
      topic: parsed.data.topic,
      context: parsed.data.context || undefined,
      brand: parsed.data.brand || undefined,
      audienceId: parsed.data.audience_id,
      platform: parsed.data.platform,
    });

    return Response.json({
      topic: parsed.data.topic,
      audience_id: parsed.data.audience_id,
      platform: parsed.data.platform,
      ideas,
      daily_limit: FREE_PLAYGROUND_IDEA_REQUESTS_PER_DAY,
      remaining_today: quota.remaining,
      usage_date: quota.usage_date,
    });
  } catch (error) {
    try {
      await refundDailyQuota(user.id, QUOTA_BUCKETS.playgroundIdea, 1);
    } catch (refundError) {
      console.error("Failed to refund playground idea quota after generation error:", {
        userId: user.id,
        refundError,
      });
    }

    const message =
      error instanceof Error ? error.message : "Failed to generate playground ideas";
    return Response.json({ error: message }, { status: 500 });
  }
}
