import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  analyzeChat,
  type AnalyzeChatInput,
  type AnalyzeVariantInput,
} from "@/lib/simulation/analyze-chat";
import type { AgentMessage } from "@/lib/simulation/types";

export const maxDuration = 60;

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
  return user;
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
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = (body ?? {}) as {
    audienceName?: unknown;
    audienceTone?: unknown;
    topArchetypes?: unknown;
    platform?: unknown;
    variants?: unknown;
  };

  if (!Array.isArray(payload.variants) || payload.variants.length === 0) {
    return Response.json({ error: "variants required" }, { status: 400 });
  }

  const variants: AnalyzeVariantInput[] = (payload.variants as unknown[])
    .map((raw, fallbackIndex) => {
      if (!raw || typeof raw !== "object") return null;
      const v = raw as {
        index?: unknown;
        label?: unknown;
        post?: unknown;
        thread?: unknown;
        aggression?: unknown;
      };
      const post = typeof v.post === "string" ? v.post.trim() : "";
      if (!post) return null;
      const thread: AgentMessage[] = Array.isArray(v.thread)
        ? (v.thread.filter(
            (m): m is AgentMessage =>
              !!m &&
              typeof m === "object" &&
              typeof (m as AgentMessage).message === "string" &&
              typeof (m as AgentMessage).sentiment === "string"
          ) as AgentMessage[])
        : [];
      return {
        index:
          typeof v.index === "number" && v.index >= 0
            ? Math.floor(v.index)
            : fallbackIndex,
        label:
          typeof v.label === "string" && v.label.trim().length > 0
            ? v.label.trim().slice(0, 60)
            : `Variant ${fallbackIndex}`,
        post: post.slice(0, 4000),
        thread,
        aggression: typeof v.aggression === "string" ? v.aggression : null,
      };
    })
    .filter((v): v is AnalyzeVariantInput => v !== null);

  if (variants.length === 0) {
    return Response.json({ error: "no usable variants" }, { status: 400 });
  }

  const input: AnalyzeChatInput = {
    audienceName:
      typeof payload.audienceName === "string"
        ? payload.audienceName.slice(0, 200)
        : null,
    audienceTone:
      typeof payload.audienceTone === "string"
        ? payload.audienceTone.slice(0, 60)
        : null,
    topArchetypes: Array.isArray(payload.topArchetypes)
      ? (payload.topArchetypes
          .map((raw) => {
            if (!raw || typeof raw !== "object") return null;
            const a = raw as { archetype?: unknown; count?: unknown };
            if (typeof a.archetype !== "string" || typeof a.count !== "number")
              return null;
            return {
              archetype: a.archetype.slice(0, 80),
              count: Math.max(0, Math.floor(a.count)),
            };
          })
          .filter(
            (a): a is { archetype: string; count: number } => a !== null
          )
          .slice(0, 12) as Array<{ archetype: string; count: number }>)
      : [],
    platform:
      typeof payload.platform === "string"
        ? payload.platform.slice(0, 40)
        : null,
    variants,
  };

  const analysis = await analyzeChat(input);
  return Response.json({ analysis });
}
