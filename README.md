# JobStream Engine

Job aggregation system — fetches listings from RSS/XML feeds, processes them through a Redis queue, and imports into MongoDB. Comes with a Next.js dashboard for tracking import history in real time.

## Live

- Frontend: https://jobstream-engine.vercel.app
- Backend: https://jobstream-engine-1.onrender.com

## Setup

You need Node 18+, MongoDB, and Redis running locally. Copy `.env.example` to `.env` in the server folder — the defaults work out of the box if Mongo and Redis are both on localhost.

```bash
cd server
cp .env.example .env
npm install
npm run dev

# second terminal
cd client
cp .env.example .env.local
npm install
npm run dev
```

Server runs on 5001, dashboard on 3000. The worker starts automatically with the server — no separate process needed.

Or with Docker, which handles Mongo and Redis for you:

```bash
docker compose up -d
```

## Env variables

Most of the defaults in `.env.example` are fine for local dev. The ones you'll actually change:

- `MONGODB_URI` — point this at Atlas or your own instance if not running Mongo locally
- `REDIS_HOST` / `REDIS_PASSWORD` / `REDIS_TLS` — if using a managed Redis like Upstash instead of local
- `BATCH_SIZE` — how many jobs go into each MongoDB `bulkWrite` call (default 100)
- `QUEUE_CONCURRENCY` — how many feeds get processed at the same time (default 5)

## How it works

The cron job runs every hour. It reads active feed URLs out of MongoDB and drops one Bull job per feed into the queue. The worker picks those up, fetches the XML, parses it, and upserts the jobs into MongoDB using `bulkWrite` — one round trip per batch regardless of how many jobs are in it.

Failed feeds retry up to 3 times with exponential backoff. If it's a parse error though, it fails fast — retrying malformed XML won't help. Each import run writes an `ImportLog` with the counts and any failure details. The dashboard updates via Socket.IO, with polling as backup.

```
Cron / Dashboard  →  Bull Queue (Redis)  →  Worker  →  MongoDB
                                              ↓
                                        Socket.IO  →  Dashboard
```

## API

```
POST  /api/imports/trigger-bulk        queue all feeds
POST  /api/imports/trigger             queue one feed { url: "..." }
GET   /api/imports/stats               dashboard numbers + queue state
GET   /api/imports/history             import logs, paginated
GET   /api/imports/history/:id         single log with failure details
GET   /api/imports/feeds               registered feeds
```

## Project structure

```
client/                  Next.js dashboard
  src/app/               page + layout
  src/components/        StatsCards, ImportHistoryTable, Pagination, Header
  src/lib/               API client, socket setup

server/
  src/config/            DB connection
  src/models/            Mongoose schemas (Job, JobFeed, ImportLog)
  src/controllers/       route handlers
  src/services/          cron, fetcher, import logic
  src/queues/            Bull queue
  src/workers/           queue processor
  src/utils/             logger, XML parser, job transformer

docs/architecture.md     why things are set up the way they are
docker-compose.yml       local dev with Docker
```

## Feeds

Feeds are stored in the `JobFeed` collection and seeded on first run. To add one, just insert a document with the URL and `isActive: true` — the cron picks it up next cycle.

Current feeds: Jobicy (all categories + specific ones like SMM, data science, business, management, design, copywriting, seller/France) and HigherEdJobs.

## Tests

```bash
cd server && npm test
```
