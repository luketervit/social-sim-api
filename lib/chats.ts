import { supabaseAdmin } from "@/lib/supabase/admin";

export interface PersistedChat {
  id: string;
  title: string;
  audience_id: string | null;
  audience_name: string | null;
  audience_row_count: number | null;
  platform: string | null;
  post: string;
  persona_cap: number;
  mode: string | null;
  variants: unknown;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  "id, title, audience_id, audience_name, audience_row_count, platform, post, persona_cap, mode, variants, created_at, updated_at";

export async function listChatsForUser(userId: string): Promise<PersistedChat[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("chats")
    .select(COLUMNS)
    .eq("owner_user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("listChatsForUser failed:", error);
    return [];
  }
  return (data ?? []) as PersistedChat[];
}

export interface ChatUpsertInput {
  id: string;
  title: string;
  audience_id: string | null;
  audience_name: string | null;
  audience_row_count: number | null;
  platform: string | null;
  post: string;
  persona_cap: number;
  mode: string | null;
  variants: unknown;
}

export async function upsertChatForUser(
  userId: string,
  input: ChatUpsertInput
): Promise<PersistedChat | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("chats")
    .upsert(
      {
        id: input.id,
        owner_user_id: userId,
        title: input.title.slice(0, 200),
        audience_id: input.audience_id,
        audience_name: input.audience_name?.slice(0, 200) ?? null,
        audience_row_count: input.audience_row_count,
        platform: input.platform,
        post: input.post.slice(0, 4000),
        persona_cap: input.persona_cap,
        mode: input.mode,
        variants: input.variants,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select(COLUMNS)
    .maybeSingle();
  if (error) {
    console.error("upsertChatForUser failed:", error);
    return null;
  }
  return (data as PersistedChat) ?? null;
}

export async function deleteChatForUser(
  userId: string,
  chatId: string
): Promise<boolean> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("chats")
    .delete()
    .eq("id", chatId)
    .eq("owner_user_id", userId);
  if (error) {
    console.error("deleteChatForUser failed:", error);
    return false;
  }
  return true;
}
