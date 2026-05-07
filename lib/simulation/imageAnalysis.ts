import { z } from "zod";

export const SimulationImageAnalysisSchema = z.object({
  literal_description: z.string().min(1),
  image_type: z.string().min(1),
  visible_elements: z.array(z.string()).default([]),
  tone_signals: z.array(z.string()).default([]),
  linkedin_interpretation: z.string().min(1),
  text_interaction: z.string().min(1),
  audience_effects: z.array(z.string()).default([]),
  risk_flags: z.array(z.string()).default([]),
  uncertainty_notes: z.array(z.string()).default([]),
});

export type SimulationImageAnalysis = z.infer<
  typeof SimulationImageAnalysisSchema
>;

export function buildImageContextBlock(
  analysis: SimulationImageAnalysis | null | undefined
): string | null {
  if (!analysis) return null;

  const lines = [
    "Attached image context:",
    `- Literal description: ${analysis.literal_description}`,
    `- Image type: ${analysis.image_type}`,
    `- Key visible elements: ${analysis.visible_elements.join(", ") || "none"}`,
    `- Tone signals: ${analysis.tone_signals.join(", ") || "none"}`,
    `- Platform interpretation: ${analysis.linkedin_interpretation}`,
    `- Interaction with post text: ${analysis.text_interaction}`,
    `- Likely audience effects: ${analysis.audience_effects.join(", ") || "none"}`,
    `- Risk flags: ${analysis.risk_flags.join(", ") || "none"}`,
  ];

  if (analysis.uncertainty_notes.length > 0) {
    lines.push(
      `- Uncertainty / ambiguity: ${analysis.uncertainty_notes.join(", ")}`
    );
  }

  return lines.join("\n");
}
