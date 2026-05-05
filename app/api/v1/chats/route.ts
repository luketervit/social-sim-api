import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { listChatsForUser, upsertChatForUser } from "@/lib/chats";

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

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const chats = await listChatsForUser(user.id);
  return Response.json({ chats });
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
    id?: unknown;
    title?: unknown;
    audienceId?: unknown;
    audienceName?: unknown;
    audienceRowCount?: unknown;
    platform?: unknown;
    post?: unknown;
    personaCap?: unknown;
    mode?: unknown;
    variants?: unknown;
  };

  if (typeof payload.id !== "string" || payload.id.length === 0) {
    return Response.json({ error: "id required" }, { status: 400 });
  }

  const chat = await upsertChatForUser(user.id, {
    id: payload.id,
    title: typeof payload.title === "string" ? payload.title : "New chat",
    audience_id:
      typeof payload.audienceId === "string" ? payload.audienceId : null,
    audience_name:
      typeof payload.audienceName === "string" ? payload.audienceName : null,
    audience_row_count:
      typeof payload.audienceRowCount === "number"
        ? payload.audienceRowCount
        : null,
    platform: typeof payload.platform === "string" ? payload.platform : null,
    post: typeof payload.post === "string" ? payload.post : "",
    persona_cap:
      typeof payload.personaCap === "number" && payload.personaCap > 0
        ? Math.floor(payload.personaCap)
        : 25,
    mode: typeof payload.mode === "string" ? payload.mode : null,
    variants: Array.isArray(payload.variants) ? payload.variants : [],
  });

  if (!chat) {
    return Response.json({ error: "Could not save chat" }, { status: 500 });
  }
  return Response.json({ chat });
}
