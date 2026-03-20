# AGENTS.md

AI assistant context for the Social Simulation API (B2B Infrastructure).

## Project

- **Goal:** API for predictive Agent-Based Modeling (ABM) of social discourse.
- **Stage:** "Wizard of Oz" Hackathon MVP (Pre-Seed)
- **Stack:** Next.js 16 (App Router), TypeScript, Supabase, OpenRouter (Llama 3.1 8B)
- **Core IP:** Extracting psychographic "Agent DNA" and running multi-agent simulations using uncensored local/cloud LLMs to predict social backlash.

## Domain Terminology

- **Agent DNA (Universal Persona Matrix):** A JSON object defining a synthetic agent's personality (e.g., reactivity baseline, brand affinity, sophistication, core values).
- **The Ghost Shift:** The latent opinion shift of "lurkers" (the silent majority). The model tracks the specific "action threshold" where a lurker becomes angry enough to post.
- **Environment:** The context of the simulation (e.g., `twitter` for short-form hostile, `slack` for corporate, `reddit` for long-form anonymous).
- **Batteries-Included Audiences:** Pre-computed static JSON files containing Agent DNA for specific demographics stored in `train/` and seeded to the `audiences` table.

## Structure

```text
social-sim-api/
├── app/
│   ├── layout.tsx              # Dark theme layout with nav
│   ├── page.tsx                # Landing page with hero + mock terminal
│   ├── globals.css             # Tailwind base styles
│   ├── keys/page.tsx           # API key generation (client component)
│   ├── docs/page.tsx           # Documentation (server component)
│   └── api/v1/
│       ├── simulate/route.ts   # POST - streaming NDJSON simulation
│       └── keys/route.ts       # POST - API key creation
├── lib/
│   ├── env.ts                  # Zod-validated environment variables
│   ├── auth.ts                 # API key validation + credit decrement
│   ├── schemas.ts              # Zod schemas (Persona, SimulateInput, CreateKey)
│   ├── supabase/
│   │   ├── server.ts           # Service-role Supabase client
│   │   └── browser.ts          # Anon/publishable Supabase client
│   └── simulation/
│       ├── types.ts            # SimulationState, AgentMessage types
│       ├── prompts.ts          # Platform-specific system prompts
│       ├── llm.ts              # OpenRouter LLM client
│       └── engine.ts           # AsyncGenerator state machine (10 rounds)
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # audiences, api_keys, simulations tables
├── scripts/
│   └── seed.ts                 # Seed audiences from train/ JSON files
├── train/                      # 5 persona JSON files (~150 agents total)
└── .env                        # Environment variables (gitignored)
```
