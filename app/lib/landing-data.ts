import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

export const FALLBACK_AUDIENCES = [
  { id: "genz", name: "Gen Z" },
  { id: "toxic_gamers", name: "Toxic Gamers" },
  { id: "engineers", name: "Engineers" },
  { id: "small_town", name: "Small Town" },
  { id: "company_internal", name: "Company Internal" },
];

export async function getLandingData() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const db = supabaseAdmin();
  const { data: audiences } = await db
    .from("audiences")
    .select("id, name")
    .order("name", { ascending: true });

  return {
    user,
    audiences: audiences?.length ? audiences : FALLBACK_AUDIENCES,
  };
}
