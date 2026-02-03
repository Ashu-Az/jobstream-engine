# JobStream Engine

Pulls job listings from multiple RSS/XML feeds, queues them through Redis, imports into MongoDB, and shows everything on a real-time dashboard.

## Live

| Service | URL |
|---|---|
| Frontend | https://jobstream-engine.vercel.app |
| Backend | https://jobstream-engine-1.onrender.com |

## How it works

1. A cron job runs every hour (or you click "Trigger Bulk Import" on the dashboard). It reads the active feed URLs from MongoDB and pushes one Bull job per feed into the queue.
2. The worker picks jobs off the queue (5 at a time by default), fetches the XML, parses it, and runs a `bulkWrite` upsert into MongoDB. One round-trip per batch — no per-document queries.
3. If a feed times out or returns bad data, Bull retries up to 3 times with exponential backoff. XML parse errors fail immediately since retrying won't fix malformed markup.
4. Each import run gets its own `ImportLog` document — tracks how many jobs were fetched, created, updated, or failed, plus the reason for each failure.
5. Socket.IO pushes status updates to the dashboard as they happen. The frontend also polls while the queue is active, so nothing falls through if a socket event gets dropped.

```
Cron / Dashboard  →  Bull Queue (Redis)  →  Worker  →  MongoDB (bulkWrite upsert)
                                              ↓
                                        Socket.IO  →  Next.js Dashboard
```

## Prerequisites

- Node.js 18 or later
- MongoDB 6+ (install via [MongoDB docs](https://www.mongodb.com/docs/manual/installation/) or use Atlas)
- Redis 7+ (install via your package manager or use a managed service like Upstash)

Make sure both MongoDB and Redis are running before you start the server.

## Running locally

```bash
# 1. Clone and go to the repo root
git clone <repo-url>
cd jobstream-engine

# 2. Backend — starts the Express server AND the queue worker in the same process
cd server
cp .env.example .env          # edit if your Mongo/Redis URLs differ from defaults
npm install
npm run dev

# 3. Frontend — open a second terminal
cd ../client
cp .env.example .env.local    # defaults point to localhost:5001, usually fine
npm install
npm run dev                   # opens on http://localhost:3000
```

That's it. Open the dashboard, hit "Trigger Bulk Import", and watch the history table fill in.

### Docker (alternative)

If you'd rather not install Mongo and Redis yourself, Docker Compose spins up everything:

```bash
docker compose up -d
```

Frontend will be at `http://localhost:3000`.

## Environment variables

**server/.env** (copy from `.env.example`)

| Variable | Default | What it does |
|---|---|---|
| `PORT` | 5001 | HTTP server port |
| `MONGODB_URI` | `mongodb://localhost:27017/job-importer` | MongoDB connection string |
| `REDIS_HOST` | localhost | Redis host |
| `REDIS_PORT` | 6379 | Redis port |
| `REDIS_PASSWORD` | — | Redis auth (leave blank if none) |
| `REDIS_TLS` | false | Set to `true` for managed Redis like Upstash |
| `QUEUE_CONCURRENCY` | 5 | How many feeds the worker processes in parallel |
| `BATCH_SIZE` | 100 | Jobs per `bulkWrite` call to MongoDB |
| `MAX_RETRY_ATTEMPTS` | 3 | Bull retry count per feed |
| `CRON_SCHEDULE` | `0 * * * *` | Cron expression — default is every hour |
| `REQUEST_TIMEOUT` | 30000 | Feed fetch timeout in ms |
| `CLIENT_URL` | `http://localhost:3000` | Frontend origin, used for CORS and Socket.IO |

**client/.env.local** (copy from `.env.example`)

| Variable | Default |
|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5001/api` |
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:5001` |

## API

| Method | Path | Description |
|---|---|---|
| POST | `/api/imports/trigger-bulk` | Queue all active feeds |
| POST | `/api/imports/trigger` | Queue a single feed (body: `{ url }`) |
| GET | `/api/imports/stats` | Dashboard stats and current queue counts |
| GET | `/api/imports/history` | Paginated import log (`?page=1&limit=20&status=completed`) |
| GET | `/api/imports/history/:id` | Single import log with failure details |
| GET | `/api/imports/feeds` | All registered feeds |

## Project layout

```
├── client/                 Next.js dashboard
│   └── src/
│       ├── app/            Pages
│       ├── components/     StatsCards, ImportHistoryTable, Pagination, Header
│       ├── lib/            Axios client, Socket.IO setup
│       └── types/          TypeScript interfaces
├── server/                 Express API + Bull worker
│   └── src/
│       ├── config/         MongoDB connection
│       ├── controllers/    HTTP handlers
│       ├── middleware/     Error handler, 404
│       ├── models/         Mongoose schemas — Job, JobFeed, ImportLog
│       ├── queues/         Bull queue setup and helpers
│       ├── routes/         Express router
│       ├── services/       Cron scheduler, XML fetcher, import logic
│       ├── utils/          Winston logger, XML parser, job transformer
│       └── workers/        Bull queue processor
├── docs/
│   └── architecture.md     Design decisions and system design
├── docker-compose.yml
└── README.md
```

## Feed sources

The feeds are stored in MongoDB (`JobFeed` collection) and seeded automatically on first run. Current list:

1. Jobicy — All Jobs
2. Jobicy — Social Media Marketing (full-time)
3. Jobicy — Seller, France (full-time)
4. Jobicy — Design & Multimedia
5. Jobicy — Data Science
6. Jobicy — Copywriting
7. Jobicy — Business
8. Jobicy — Management
9. HigherEdJobs — Education

To add a new feed: insert a document into the `JobFeed` collection with `isActive: true` and the URL. The next cron run picks it up. No code change needed.

## Running tests

```bash
cd server
npm test
```

## Assumptions

- The worker runs inside the same process as the API server. If you need to scale them independently (e.g. multiple worker instances), extract the worker into its own service and point it at the same Redis queue. The code in `workers/jobWorker.js` is already self-contained for that.
- `rawData` on each job document keeps the original parsed XML payload. Useful for debugging feed changes, but adds storage per document. Remove the field from the transformer if storage is a concern at scale.
- Feed URLs that return malformed XML will show up as failed imports in the history with the parse error. They stay in the feed list so you can see what's happening rather than silently skipping them.
