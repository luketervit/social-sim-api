import { z } from "zod";

export const PersonaSchema = z.object({
  id: z.string(),
  archetype: z.string(),
  reactivity_baseline: z.number().min(0).max(1),
  sophistication: z.number().min(0).max(1),
  brand_affinity: z.number().min(-1).max(1),
  core_values: z.array(z.string()),
  persona_prompt: z.string(),
});

export type Persona = z.infer<typeof PersonaSchema>;

export const SimulateInputSchema = z.object({
  audience_id: z.string().min(1),
  platform: z.enum(["twitter", "slack", "reddit"]),
  input: z.string().min(1).max(2000),
});

export type SimulateInput = z.infer<typeof SimulateInputSchema>;

export const CreateKeySchema = z.object({
  email: z.string().email(),
});
