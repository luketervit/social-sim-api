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

4. Seed the audiences:

```bash
npm run seed
```

5. Start the dev server:

```bash
npm run dev
```

## API Usage

### Get an API Key

```bash
curl -X POST http://localhost:3000/api/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com"}'
```

### Run a Simulation

```bash
curl -N -X POST http://localhost:3000/api/v1/simulate \
  -H "x-api-key: ssim_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "audience_id": "toxic_gamers",
    "platform": "twitter",
    "input": "We are proud to announce NFTs in our next game!"
  }'
```

### Available Audiences

- `toxic_gamers` - Hardcore gaming community
- `genz` - Gen Z social media users
- `engineers` - Software engineering community
- `small_town` - Small town community
- `company_internal` - Corporate internal comms

### Platforms

- `twitter` - Short-form, hostile, 280 char limit
- `slack` - Corporate, passive-aggressive
- `reddit` - Long-form, anonymous

## Frontend

- `/` - Landing page
- `/keys` - API key generation
- `/docs` - Interactive documentation
