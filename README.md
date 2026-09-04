# Fathoms

**Don't just know something. Fathom it.**

Fathoms is an AI-powered knowledge and communication training platform prototype. Learn something new, understand it deeply, explain it clearly, and get better every time.

## Quick Start

```bash
npm install
cp .env.example .env
npm start
```

Open [http://localhost:3000](http://localhost:3000), then **Initialize** to create your profile.

## Progressive Web App

Visit [/app](http://localhost:3000/app) to install Fathoms on your home screen.

- Manifest: `/manifest.webmanifest` (starts at `/init` — sign up; logged-in users continue to practice)
- Service worker: `/sw.js` (registered on every page)
- Installed app skips public marketing pages (`/`, `/about`, `/app`) and opens sign up instead
- Chrome/Edge: one-tap **Install Fathoms** when the browser is ready
- iPhone: Share → **Add to Home Screen**

HTTPS (or `localhost`) is required for install prompts. Home screen icons use the favicon.

## Environment Variables

Copy `.env.example` to `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `SESSION_SECRET` | Cookie signing secret | dev default |
| `USE_JSON_FALLBACK` | Force JSON file database | `true` |

## Database

The app uses **PostgreSQL** when available, and automatically falls back to a local **JSON file** at `data/fallback.json`.

On first start, topics and achievements are seeded. **No demo user or fake session history** is created — you create a fresh profile on the Initialize screen.

### PostgreSQL Setup (Optional)

```bash
createdb fathoms
# Set DATABASE_URL in .env
# Set USE_JSON_FALLBACK=false
npm run seed
npm start
```

### JSON Fallback (Default)

No database setup required. Topic seed data is created automatically on first start.

```bash
USE_JSON_FALLBACK=true npm start
```

## Seed Data

Run manually (idempotent — skips if topics already exist):

```bash
npm run seed
```

Includes:
- 80+ topics across categories
- Achievement definitions

User accounts, sessions, and scores start empty.

## Project Structure

```
fathoms/
├── server/           # Express backend
│   ├── routes/       # REST API endpoints
│   ├── services/     # AI (mock), XP, achievements, stats
│   └── database/     # PostgreSQL + JSON adapters
├── public/           # Frontend (HTML/CSS/JS)
│   ├── css/          # Design system
│   └── js/           # API client, pages, practice flow
├── data/             # JSON fallback database
└── .env.example
```

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/demo` | Login as demo user |
| GET | `/api/auth/me` | Current user |
| GET | `/api/dashboard/:userId` | Progress snapshot (practice focus) |
| GET | `/api/topics/random` | Random topic |
| POST | `/api/sessions` | Start session |
| POST | `/api/sessions/:id/evaluate` | Submit for evaluation |
| GET | `/api/stats/:userId` | Full stats overview |
| GET | `/api/achievements` | Achievements |
| PATCH | `/api/users/:id/settings` | Update settings |

## Demo Evaluation

This prototype uses a **mock AI evaluation service** — no external AI API calls are made. All results are labeled **Demo Evaluation** in the UI. The architecture supports swapping in a real AI provider via `server/services/aiService.js`.

## Practice Flow

1. **Prompt** — Receive a random topic
2. **Research** — 5-minute timer, mock sources, notes
3. **Speak** — 60-second microphone recording (stored locally)
4. **Results** — Scores, feedback, XP, retry option

## License

Prototype for demonstration purposes.
