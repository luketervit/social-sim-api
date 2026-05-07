import { z } from "zod";

export const PersonaSenioritySchema = z.enum([
  "junior",
  "mid",
  "senior",
  "director",
  "executive",
]);

export const PersonaRoleFamilySchema = z.enum([
  "founder",
  "marketing",
  "sales",
  "product",
  "engineering",
  "operations",
  "finance",
  "people",
  "design",
  "investor",
  "generalist",
]);

export const PersonaSchema = z.object({
  id: z.string(),
  archetype: z.string(),
  reactivity_baseline: z.number().min(0).max(1),
  sophistication: z.number().min(0).max(1),
  brand_affinity: z.number().min(-1).max(1),
  core_values: z.array(z.string()),
  persona_prompt: z.string(),
  role_hint: z.string().optional(),
  seniority: PersonaSenioritySchema.optional(),
  role_family: PersonaRoleFamilySchema.optional(),
  topical_expertise: z.array(z.string()).optional(),
  professional_voice: z.string().optional(),
});

export type Persona = z.infer<typeof PersonaSchema>;

export const SimulateInputSchema = z.object({
  audience_id: z.string().min(1),
  platform: z.enum(["twitter", "slack", "reddit", "linkedin"]),
  input: z.string().min(1).max(2000),
});

export type SimulateInput = z.infer<typeof SimulateInputSchema>;

export const CreateKeySchema = z.object({
  email: z.string().email(),
});
