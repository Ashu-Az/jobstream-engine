# JobStream Engine

Pulls job listings from multiple RSS/XML feeds, queues them through Redis, and imports them into MongoDB. There's a Next.js dashboard on top that shows import history and live queue status.

## Live

- Frontend: https://jobstream-engine.vercel.app
- Backend: https://jobstream-engine-1.onrender.com

## Setup

Need Node 18+, MongoDB, and Redis running locally. Everything else is in `.env.example` — defaults work if Mongo and Redis are both on localhost.

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

Server on 5001, dashboard on 3000. Worker starts inside the server process automatically, no extra terminal needed.

If you don't want to run Mongo and Redis yourself, Docker handles all of it:

```bash
docker compose up -d
```

The only env vars you'd realistically change from the defaults are `MONGODB_URI` and the Redis ones (`REDIS_HOST`, `REDIS_PASSWORD`, `REDIS_TLS`) if you're pointing at a cloud instance. `BATCH_SIZE` and `QUEUE_CONCURRENCY` are there if you want to tune throughput.

## How it all fits together

```
Cron / Dashboard  →  Bull Queue (Redis)  →  Worker  →  MongoDB
                                              ↓
                                        Socket.IO  →  Dashboard
```

Every hour a cron job fires, reads the active feed URLs out of MongoDB, and throws one Bull job per feed into the queue. The worker picks those up, fetches the XML from each URL, parses it, and writes the jobs into MongoDB. Once an import finishes, Socket.IO pushes the result to the dashboard. The frontend also polls every few seconds while there's stuff in the queue, so if a socket event gets dropped the numbers still stay correct.

## Why I picked these tools

For the queue I looked at both Bull and BullMQ. Bull v4 is simpler — it works with the standard redis package and I didn't need any of the extra stuff BullMQ brings. So I went with Bull.

MongoDB was the obvious call here because the job feeds don't all have the same shape. Trying to force a rigid schema on that would be a constant fight. I used Mongoose on top of it because it gives validation and index management without needing a migration system, which felt like overkill for this.

I went with Express over Nest for the backend. This is a single service, not a big platform — Nest adds a lot of structure that we don't need here. Next.js 14 on the frontend for the dashboard, with Tailwind and shadcn/ui for the components. shadcn gives us accessible, decent-looking components without pulling in a heavy UI library.

For real-time updates I used Socket.IO, but I didn't want to rely on it completely — WebSockets can be unreliable on managed hosting like Render. So the dashboard also polls every few seconds while the queue is active. Belt and suspenders.

## How the import actually works

This is the part I thought about the most. The naive approach — loop through jobs, do a `findOne`, then either `create` or `update` — sounds fine until you think about scale. That's two DB queries per job, and if two jobs in the same batch share a `jobId` you get a race condition where both pass the `findOne` check and one crashes on the unique index.

So instead I use `bulkWrite` with `updateOne` + `upsert: true` on each item. One round trip to MongoDB per batch, and MongoDB handles the find-or-insert atomically at the document level. No race condition, no N+1 queries. I set `ordered: false` so a single bad document doesn't block the rest of the batch.

For deduplication, each job needs a stable ID. If the RSS feed gives us a `<guid>` we use that directly. If not, I generate an MD5 hash from the link + title + publish date — it's deterministic so the same job fetched twice always gets the same hash.

`bulkWrite` tells us exactly how many documents were inserted vs updated via `upsertedCount` and `modifiedCount`, so we don't need extra queries to figure out the stats.

One thing I was mindful of: the import log was updating after every single batch. At 1M jobs with a batch size of 100 that's 10,000 extra writes just to keep the dashboard counter live. I throttled it to update every 10 batches instead. The final numbers get written when the import finishes, so nothing is lost.

## Indexes

I trimmed the indexes down on purpose. The Job collection had individual indexes on title, company, location, category, jobType, publishedDate, isActive — none of which are actually queried on their own anywhere in the code. Each extra index slows down every write, and at a million+ documents that cost is real.

What's left is what we actually need: the unique index on `jobId` (dedup key), a compound index on `(source, jobId)` for feed-scoped lookups, `createdAt` descending for sorting, and a text index on title + description in case we add search later.

## Feeds

Feeds live in the `JobFeed` collection and get seeded automatically the first time the server starts. To add a new one, just insert a document with the URL and set `isActive: true` — the cron will pick it up on the next run. No code change needed.

Current feeds are a bunch of Jobicy categories (SMM, data science, business, management, design, copywriting, seller/France, and the general feed) plus HigherEdJobs. The HigherEdJobs feed has some XML issues so it'll usually show up as failed in the import history — that's expected, it logs the parse error and moves on rather than crashing.

## A few assumptions worth knowing

The worker runs inside the same Express process right now. That's fine for the current load, but if you ever need to scale it out — multiple workers hitting the queue in parallel — the code in `workers/jobWorker.js` is already self-contained for that. You'd just pull out the `startWorker()` call from `index.js` and run it as its own service pointed at the same Redis queue.

Each job document stores the raw parsed XML in a `rawData` field. Handy for debugging when a feed changes its format, but it does add storage. If that becomes a problem at scale, just remove it from the transformer.

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
client/
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

docker-compose.yml       local dev with Docker
```

## Tests

```bash
cd server && npm test
```
