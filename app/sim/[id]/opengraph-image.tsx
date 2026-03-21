import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

interface RouteProps {
  params: Promise<{ id: string }>;
}

async function getPublicSimulation(id: string) {
  const db = supabaseAdmin();
  const { data } = await db
    .from("simulations")
    .select("title, summary, platform, audience_id, aggression_score, progress_messages, persona_cap")
    .eq("id", id)
    .eq("public", true)
    .maybeSingle();

  return data;
}

export default async function OpenGraphImage({ params }: RouteProps) {
  const { id } = await params;
  const simulation = await getPublicSimulation(id);

  const title = simulation?.title ?? "Public Simulation";
  const summary =
    simulation?.summary ?? "Inspect the thread, sentiment shift, and backlash profile.";
  const tags = [
    simulation?.platform ?? "platform",
    simulation?.audience_id?.replace(/_/g, " ") ?? "audience",
    simulation?.persona_cap ? `${simulation.persona_cap}-agent sample` : null,
    simulation?.progress_messages ? `${simulation.progress_messages} messages` : null,
  ].filter((item): item is string => Boolean(item));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          background:
            "radial-gradient(circle at top right, rgba(228,228,231,0.14), transparent 30%), linear-gradient(180deg, #121216 0%, #09090b 100%)",
          color: "#e4e4e7",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              maxWidth: "820px",
            }}
          >
            <div
              style={{
                fontSize: 22,
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "#a1a1aa",
              }}
            >
              Atharias / Shared Simulation
            </div>
            <div
              style={{
                fontSize: 72,
                lineHeight: 0.95,
                letterSpacing: "-0.06em",
                fontWeight: 700,
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 30,
                lineHeight: 1.35,
                color: "#d4d4d8",
              }}
            >
              {summary}
            </div>
          </div>
          {simulation?.aggression_score ? (
            <div
              style={{
                display: "flex",
                padding: "16px 20px",
                borderRadius: "999px",
                border: "1px solid rgba(82,82,91,0.82)",
                background: "rgba(24,24,27,0.78)",
                fontSize: 24,
                color: "#f97316",
                textTransform: "capitalize",
              }}
            >
              {simulation.aggression_score}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "20px",
          }}
        >
          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
            {tags.map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  padding: "12px 16px",
                  borderRadius: "999px",
                  border: "1px solid rgba(63,63,70,0.78)",
                  background: "rgba(9,9,11,0.58)",
                  fontSize: 22,
                  color: "#d4d4d8",
                  textTransform: "capitalize",
                }}
              >
                {item}
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: 26,
              color: "#71717a",
              letterSpacing: "0.04em",
            }}
          >
            atharias.ai
          </div>
        </div>
      </div>
    ),
    size
  );
}
