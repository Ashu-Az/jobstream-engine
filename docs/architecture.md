# Architecture & Design Decisions

## System Overview

JobStream Engine is a job aggregation pipeline. It fetches job listings from multiple RSS/XML feeds on a schedule, processes them through a Redis-backed queue, upserts them into MongoDB, and exposes a real-time dashboard showing import history and live queue status.

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌─────────────┐
│  Cron Job   │────▶│  Bull Queue  │────▶│  Worker       │────▶│  MongoDB    │
│  (1 hr)     │     │  (Redis)     │     │  (processor)  │     │  (upsert)   │
└─────────────┘     └──────────────┘     └───────┬───────┘     └─────────────┘
                                                 │
                    ┌────────────────────────────┘
                    │  Socket.IO (job events)
                    ▼
┌─────────────┐     ┌──────────────┐
│  Next.js    │◀────│  Express     │
│  Dashboard  │     │  API + IO    │
└─────────────┘     └──────────────┘
```

### Data flow — step by step

1. **Cron triggers** (every hour, or manually via the dashboard button). It reads all active feed URLs from the `JobFeed` collection and pushes one Bull job per URL into the queue.
2. **Bull queue** holds the jobs in Redis. Concurrency is configurable (`QUEUE_CONCURRENCY`, default 5). Each job has up to 3 retry attempts with exponential backoff.
3. **Worker picks up a job**, fetches the XML from the feed URL, parses it with `xml2js`, transforms each item into the internal job schema, and runs a `bulkWrite` against MongoDB using upsert operations.
4. **ImportLog** is created before the fetch starts and updated in real time as batches complete. It records new/updated/failed counts and stores failure reasons.
5. **Socket.IO** pushes `import:completed`, `import:failed`, and `import:progress` events to the dashboard. The frontend also polls every 2–3 seconds while the queue is non-empty, so the dashboard stays current even if a socket event is missed.

---

## Technology Choices & Rationale

| Decision | Choice | Why |
|---|---|---|
| Queue | Bull (not BullMQ) | Bull v4 is battle-tested, has a simple API, and works with the standard `redis` package. BullMQ requires `ioredis` and adds complexity we don't need yet. |
| Database | MongoDB + Mongoose | Schema-flexible — job feeds vary in structure. Mongoose gives us validation and indexes without a migration system. |
| ORM layer | Mongoose (not Prisma, not raw driver) | Familiar middleware ecosystem, built-in population, and hooks. Prisma doesn't support MongoDB well. |
| Backend | Express (not Nest) | Simpler for a single-service backend. Nest is worth the boilerplate only when you have many modules with distinct lifecycles. |
| Frontend | Next.js 14 + Tailwind + shadcn/ui | Next.js handles routing and SSR out of the box. shadcn/ui gives accessible, composable components without a heavy design-system dependency. |
| Real-time | Socket.IO + polling fallback | Socket.IO covers the happy path. Polling every 2–3 seconds while the queue is active is the fallback — the dashboard stays correct even if the WebSocket connection drops. |
| Logging | Winston | Structured JSON logs, configurable transports (file + console), rotation via `maxsize`/`maxFiles`. |

---

## MongoDB Schema Design

### Job collection

```
jobId        (String, unique, indexed)   ← primary dedup key (from RSS guid or MD5 of link+title+date)
title        (String, indexed)
company      (String, indexed)
location     (String, indexed)
description  (String)
url          (String)
publishedDate(Date, indexed)
jobType      (String, indexed)
category     (String, indexed)
source       (String, indexed)           ← the feed URL that produced this job
rawData      (Mixed)                     ← original parsed XML object, kept for debugging
isActive     (Boolean, indexed)
timestamps   (createdAt, updatedAt)
```

Compound index on `(source, jobId)` supports the common query pattern of "all jobs from feed X".
Text index on `(title, description)` enables full-text search if added later.

### ImportLog collection

One document per feed-import run. Tracks the full lifecycle: `pending → processing → completed | failed`. Stores per-job failure details (jobId + reason + raw data) so failures are debuggable from the dashboard without hitting the Job collection.

### JobFeed collection

Source of truth for which feeds are active. Populated on first run. Adding or disabling a feed is a single document update — no code change needed.

---

## Upsert & Deduplication Strategy

Each job from an RSS feed gets a stable `jobId`:
- If the RSS item has a `<guid>`, that's used directly.
- Otherwise, an MD5 hash of `link + title + pubDate` is generated. This is deterministic — the same job fetched twice produces the same hash.

On import, `bulkWrite` is called with a list of `updateOne` operations, each using `{ upsert: true }` and keyed on `jobId`. This is a single round-trip to MongoDB per batch regardless of batch size. The `$set` only fires if the document actually changes, and we track new vs. updated by comparing the `upsertedCount` and `modifiedCount` fields returned by `bulkWrite`.

This approach scales to millions of records because:
- One network round-trip per batch (default 100 jobs), not per job.
- MongoDB handles the find-or-insert atomically at the document level — no application-level race condition.
- The unique index on `jobId` is the only constraint needed.

---

## Queue & Retry Design

```
Bull Queue: "job-import"
  ├── attempts: 3
  ├── backoff: exponential, starting at 2 s  (2s → 4s → 8s)
  ├── concurrency: configurable (default 5)
  ├── removeOnComplete: 100  (keeps last 100 completed jobs in Redis)
  └── removeOnFail: 200      (keeps last 200 failed jobs for inspection)
```

The fetcher has its own internal retry layer (3 attempts with exponential backoff) for network-level failures. XML parsing errors skip retries — malformed XML won't fix itself on retry, so we fail fast and log the reason.

---

## Scalability Considerations

- **Batch size and concurrency are env-configurable.** `BATCH_SIZE` controls how many jobs are sent to MongoDB in one `bulkWrite`. `QUEUE_CONCURRENCY` controls how many feeds are fetched in parallel. Both can be tuned without code changes.
- **Worker is decoupled from the API server.** The worker only needs a connection to Redis and MongoDB. It can run in a separate process, container, or machine. The current setup runs it in-process for simplicity; docker-compose can be adjusted to run it separately if load requires it.
- **MongoDB connection pooling** is configured with `maxPoolSize: 10`, `minPoolSize: 5` — appropriate for the current load, tunable upward.
- **Feed list is data-driven.** New feeds are added by inserting a document into `JobFeed`, not by changing code. The cron job picks them up on the next run.

---

## Error Handling Strategy

| Layer | What happens on failure |
|---|---|
| HTTP fetch | Retried 3× with exponential backoff. Timeout at 30 s. |
| XML parsing | Fails immediately (no retry). Error logged with the raw response for debugging. |
| Job transformation | Per-job error. The job is skipped; the rest of the batch continues. |
| MongoDB write | Per-job error caught inside `bulkWrite` error handling. Recorded in `failedJobsDetails`. |
| Bull job (top level) | If the worker throws after all retries, Bull marks the job failed. `ImportLog` is finalized with status `failed` and the error message. |
| Socket.IO | Fire-and-forget. If the client isn't connected, the event is simply not delivered. The polling fallback ensures the dashboard catches up. |

---

## File Structure Rationale

```
server/src/
├── config/          MongoDB connection setup
├── controllers/     HTTP request handlers — thin, delegate to services
├── middleware/      Express middleware (error handler, 404 catcher)
├── models/          Mongoose schemas — single source of truth for data shape
├── queues/          Bull queue instantiation and helper functions
├── routes/          Express router definitions — maps URLs to controllers
├── services/        Business logic (cron scheduling, fetching, importing)
├── utils/           Stateless helpers (XML parsing, job transformation, logging)
└── workers/         Bull queue processor — the only file that calls queue.process()
```

Each layer has one job. Controllers don't touch the database directly. Services don't know about HTTP. Workers don't know about routes. This makes each piece testable in isolation and swappable without touching the rest.
