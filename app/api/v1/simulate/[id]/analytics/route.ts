import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VISITOR_COOKIE = "atharias_visitor_id";

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const db = supabaseAdmin();

  const { data: simulation, error } = await db
    .from("simulations")
    .select("id, public, public_clicks")
    .eq("id", id)
    .eq("public", true)
    .maybeSingle();

  if (error) {
    return Response.json({ error: "Failed to load simulation" }, { status: 500 });
  }

  if (!simulation) {
    return Response.json({ error: "Simulation not found" }, { status: 404 });
  }

  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value || randomUUID();
  const referrer = request.headers.get("referer");
  const userAgent = request.headers.get("user-agent");

  const { data: clickCount, error: rpcError } = await db.rpc("record_public_simulation_click", {
    p_simulation_id: id,
    p_visitor_id: visitorId,
    p_referrer: referrer,
    p_user_agent: userAgent,
  });

  if (rpcError) {
    return Response.json({ error: "Failed to record click" }, { status: 500 });
  }

  const response = NextResponse.json({
    simulation_id: id,
    public_clicks:
      typeof clickCount === "number" ? clickCount : Number(clickCount ?? simulation.public_clicks ?? 0),
  });

  if (!request.cookies.get(VISITOR_COOKIE)?.value) {
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}
