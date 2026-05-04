import { supabaseAdmin } from "@/lib/supabase/admin";
import { classifyTexts } from "./classify";
import { synthesizePersona } from "./synthesize";
import type { ParsedRow } from "./parse";

export interface ProcessAudienceInput {
  audienceId: string;
  rows: ParsedRow[];
}

/**
 * Background worker invoked via Vercel after(): classifies the upload's text
 * rows in batches, synthesizes a Persona per row, and writes the finished
 * audience back to Supabase.
 */
export async function processAudienceUpload({
  audienceId,
  rows,
}: ProcessAudienceInput): Promise<void> {
  const db = supabaseAdmin();
  try {
    const texts = rows.map((r) => r.text);
    const scored = await classifyTexts(texts);

    const personas = rows.map((row, i) => synthesizePersona(audienceId, row, scored[i]));

    const { error } = await db
      .from("audiences")
      .update({
        personas,
        status: "ready",
        row_count: personas.length,
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", audienceId);

    if (error) {
      console.error("processAudienceUpload write failed:", { audienceId, error });
      await db
        .from("audiences")
        .update({
          status: "failed",
          error_message: "Failed to save processed audience.",
        })
        .eq("id", audienceId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown processing error";
    console.error("processAudienceUpload error:", { audienceId, error: err });
    await db
      .from("audiences")
      .update({
        status: "failed",
        error_message: message.slice(0, 500),
      })
      .eq("id", audienceId);
  }
}
