import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getOperatorAccountByUserId,
  hasCurrentConsent,
} from "@/lib/operator-accounts";
import { MAX_UPLOAD_BYTES } from "@/lib/audiences/parse";
import { parseLinkedInCompleteExportAttachment } from "@/lib/audiences/linkedinExport";
import { evaluateLinkedInPrivateDataset } from "@/lib/evals/linkedinPrivate";
import type { Persona } from "@/lib/schemas";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const includeFull = request.nextUrl.searchParams.get("full") === "1";
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("audiences")
    .select(
      "id, name, platform, status, row_count, error_message, metadata, created_at, processed_at, personas"
    )
    .eq("id", id)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (error) {
    return Response.json({ error: "Failed to load audience." }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "Audience not found." }, { status: 404 });
  }

  // Trim personas in the status response to keep payloads small. Pass
  // ?full=1 to get the full array (used by the dashboard chat to drive
  // the audience analysis + simulation cap).
  const personasArray = Array.isArray(data.personas) ? data.personas : [];
  const personasPreview = personasArray.slice(0, 6);

  const response: Record<string, unknown> = {
    id: data.id,
    name: data.name,
    platform: data.platform,
    status: data.status,
    row_count: data.row_count,
    error: data.error_message,
    metadata: data.metadata,
    created_at: data.created_at,
    processed_at: data.processed_at,
    personas_preview: personasPreview,
  };
  if (includeFull) {
    response.personas = personasArray;
  }

  return Response.json(response);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = supabaseAdmin();

  const { data: owned, error: ownerError } = await db
    .from("audiences")
    .select("id")
    .eq("id", id)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (ownerError) {
    return Response.json({ error: "Failed to delete audience." }, { status: 500 });
  }
  if (!owned) {
    return Response.json({ error: "Audience not found." }, { status: 404 });
  }

  // simulations.audience_id has no ON DELETE rule — clear references so the
  // audience delete doesn't fail with a FK violation.
  const { error: simError } = await db
    .from("simulations")
    .delete()
    .eq("audience_id", id);
  if (simError) {
    return Response.json({ error: "Failed to delete audience." }, { status: 500 });
  }

  const { data, error } = await db
    .from("audiences")
    .delete()
    .eq("id", id)
    .eq("owner_user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return Response.json({ error: "Failed to delete audience." }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "Audience not found." }, { status: 404 });
  }

  return Response.json({ deleted: true, id });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getOperatorAccountByUserId(user.id);
  if (!hasCurrentConsent(account)) {
    return Response.json(
      {
        error:
          "Please review and accept the latest terms before uploading. See /terms.",
        code: "consent_required",
      },
      { status: 403 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json(
      { error: "Upload must be multipart/form-data with a 'file' field." },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing 'file' field." }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "File is empty." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: `File too large. Max ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.` },
      { status: 413 }
    );
  }

  const lowerName = file.name.toLowerCase();
  const isZip =
    lowerName.endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed";
  if (!isZip) {
    return Response.json(
      { error: "Upload your complete LinkedIn export ZIP." },
      { status: 400 }
    );
  }

  const { id } = await params;
  const db = supabaseAdmin();
  const { data: audience, error: audienceError } = await db
    .from("audiences")
    .select("id, platform, owner_user_id, metadata, personas")
    .eq("id", id)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (audienceError) {
    return Response.json({ error: "Failed to load audience." }, { status: 500 });
  }
  if (!audience) {
    return Response.json({ error: "Audience not found." }, { status: 404 });
  }
  if (audience.platform !== "linkedin") {
    return Response.json(
      { error: "LinkedIn post history can only be attached to LinkedIn audiences." },
      { status: 400 }
    );
  }

  const zipBuffer = new Uint8Array(await file.arrayBuffer());
  let parsed;
  try {
    parsed = parseLinkedInCompleteExportAttachment(zipBuffer);
  } catch {
    return Response.json(
      { error: "Could not unzip the file. Make sure it's a valid LinkedIn export ZIP." },
      { status: 400 }
    );
  }

  if (!parsed.attachment) {
    return Response.json(
      { error: "This export did not contain post history. Upload the complete LinkedIn export ZIP." },
      { status: 400 }
    );
  }

  const personas = Array.isArray(audience.personas)
    ? (audience.personas as Persona[])
    : [];
  const evalResult =
    personas.length > 0
      ? evaluateLinkedInPrivateDataset(personas, parsed.attachment.posts)
      : null;
  const metadata =
    audience.metadata && typeof audience.metadata === "object"
      ? (audience.metadata as Record<string, unknown>)
      : {};

  const { error: updateError } = await db
    .from("audiences")
    .update({
      metadata: {
        ...metadata,
        linkedin_export: {
          ...parsed.attachment,
          eval: evalResult,
        },
      },
    })
    .eq("id", id)
    .eq("owner_user_id", user.id);

  if (updateError) {
    return Response.json({ error: "Failed to attach LinkedIn post history." }, { status: 500 });
  }

  return Response.json({
    ok: true,
    audience_id: id,
    linkedin_export: {
      summary: parsed.attachment.summary,
      eval: evalResult,
    },
  });
}
