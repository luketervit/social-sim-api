import { NextRequest, after } from "next/server";
import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MAX_UPLOAD_BYTES, parseUpload } from "@/lib/audiences/parse";
import { processAudienceUpload } from "@/lib/audiences/process";

export const maxDuration = 300;

const ALLOWED_PLATFORMS = new Set(["twitter", "reddit", "slack", "linkedin"]);
const NAME_MAX_CHARS = 80;

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
  if (!user || !user.email) return null;
  return { id: user.id, email: user.email };
}

function sanitiseName(input: unknown, fallback: string): string {
  if (typeof input !== "string") return fallback;
  const trimmed = input.replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) return fallback;
  return trimmed.slice(0, NAME_MAX_CHARS);
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json(
      { error: "Upload must be multipart/form-data with a 'file' field." },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Could not read upload body." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing 'file' field." }, { status: 400 });
  }

  if (file.size === 0) {
    return Response.json({ error: "File is empty." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      {
        error: `File too large. Max ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`,
      },
      { status: 413 }
    );
  }

  const platformRaw = String(formData.get("platform") ?? "twitter").toLowerCase();
  const platform = ALLOWED_PLATFORMS.has(platformRaw) ? platformRaw : "twitter";
  const fallbackName = file.name.replace(/\.[^.]+$/, "") || "Custom audience";
  const name = sanitiseName(formData.get("name"), fallbackName);

  let content: string;
  try {
    content = await file.text();
  } catch {
    return Response.json({ error: "Could not read file." }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseUpload(content, file.name);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not parse file." },
      { status: 400 }
    );
  }

  if (parsed.rows.length === 0) {
    return Response.json(
      { error: "No usable rows. Each row needs at least 8 characters of text." },
      { status: 400 }
    );
  }

  const audienceId = randomUUID();
  const db = supabaseAdmin();

  const { error: insertError } = await db.from("audiences").insert({
    id: audienceId,
    name,
    metadata: {
      text_column: parsed.text_column,
      headers: parsed.headers,
      synthetic: parsed.synthetic,
      total_rows_in_file: parsed.total_rows_in_file,
      truncated: parsed.truncated,
    },
    personas: [],
    owner_user_id: user.id,
    source: "uploaded",
    platform,
    status: "processing",
    row_count: parsed.rows.length,
  });

  if (insertError) {
    console.error("Failed to create audience row:", insertError);
    return Response.json(
      { error: "Could not create audience." },
      { status: 500 }
    );
  }

  after(() =>
    processAudienceUpload({
      audienceId,
      audienceName: name,
      platform,
      rows: parsed.rows,
      headers: parsed.headers,
      synthetic: parsed.synthetic,
    })
  );

  return Response.json(
    {
      audience_id: audienceId,
      name,
      platform,
      status: "processing",
      row_count: parsed.rows.length,
      total_rows_in_file: parsed.total_rows_in_file,
      truncated: parsed.truncated,
      text_column: parsed.text_column,
    },
    { status: 202 }
  );
}

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("audiences")
    .select(
      "id, name, platform, status, row_count, error_message, created_at, processed_at, generator_model, classifier_models, routing_decision"
    )
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to list audiences:", error);
    return Response.json({ error: "Failed to load audiences." }, { status: 500 });
  }

  return Response.json({ audiences: data ?? [] });
}
