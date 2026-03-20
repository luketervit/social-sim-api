# AGENTS.md

AI assistant context for the Social Simulation API (B2B Infrastructure).

## Project

- **Goal:** API for predictive Agent-Based Modeling (ABM) of social discourse.
- **Stage:** "Wizard of Oz" Hackathon MVP (Pre-Seed)
- **Stack:** Python 3.11+, FastAPI, Uvicorn, Pydantic, AsyncOpenAI (OpenRouter)
- **Core IP:** Extracting psychographic "Agent DNA" and running multi-agent simulations using uncensored local/cloud LLMs to predict social backlash.

## Domain Terminology

- **Agent DNA (Universal Persona Matrix):** A JSON object defining a synthetic agent's personality (e.g., reactivity baseline, brand affinity, sophistication, core values).
- **The Ghost Shift:** The latent opinion shift of "lurkers" (the silent majority). The model tracks the specific "action threshold" where a lurker becomes angry enough to post.
- **Environment:** The context of the simulation (e.g., `short-form-public` for Twitter, `corporate-internal` for Slack).
- **Batteries-Included Audiences:** Pre-computed static JSON files containing Agent DNA for specific demographics (used to bypass dynamic database ingestion for the MVP).

## Structure

```text
social-simulation-api/
├── app/
│   ├── main.py               # FastAPI application, routing, and endpoints
│   ├── api/
│   │   ├── routes.py         # Endpoints (/v1/simulate, /v1/audiences/train)
│   │   └── models.py         # Pydantic schemas (Strict typing for inputs/outputs)
│   ├── engine/
│   │   ├── llm_client.py     # AsyncOpenAI wrapper pointed at OpenRouter
│   │   └── prompts.py        # System prompts and Agent DNA injection logic
│   └── data/
│       └── audiences/        # Hardcoded MVP JSON files (Batteries Included)
│           ├── aud_gamers.json
│           └── aud_politics.json
├── docs/                     # Living docs and API specs
├── tests/                    # Endpoint and LLM mock tests
├── requirements.txt          # Dependencies (fastapi, uvicorn, openai, pydantic)
└── .env                      # OPENROUTER_API_KEY (gitignored)
```
