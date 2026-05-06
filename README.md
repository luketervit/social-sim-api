# Atharias

Simulations, simplified. A full-stack API that runs multi-agent social discourse simulations using psychographic "Agent DNA" personas.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Supabase (PostgreSQL + RLS)
- **LLM:** meta-llama/llama-3.1-8b-instruct via OpenRouter
- **Frontend:** Tailwind CSS, dark theme

## Setup

1. Clone the repo and install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env`:

```
OPENROUTER_API_KEY=sk-or-v1-xxx
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
```

3. Run the database migration:

```bash
supabase db push
```

4. Start the dev server:

```bash
npm run dev
```

## API Usage

### Upload an Audience

```bash
curl -X POST http://localhost:3000/api/v1/audiences \
  -H "Cookie: your_session_cookie" \
  -F "platform=twitter" \
  -F "name=Beta Testers" \
  -F "file=@./audience.csv"
```

### Run a Simulation

```bash
curl -X POST http://localhost:3000/api/v1/simulate \
  -H "Cookie: your_session_cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "audienceId": "uuid-from-upload",
    "platform": "twitter",
    "input": "We are sunsetting the free tier next month.",
    "personaCap": 25
  }'
```

### Platforms

- `twitter` - Short-form, hostile, 280 char limit
- `slack` - Corporate, passive-aggressive
- `reddit` - Long-form, anonymous

## Frontend

- `/` - Landing page
- `/docs` - Product documentation
- `/waitlist` - Early access flow
- `/dashboard` - Audience upload and simulation UI
