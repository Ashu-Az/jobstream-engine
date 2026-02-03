# Architecture notes

## How data moves through the system

```
┌─────────┐    ┌────────────┐    ┌────────┐    ┌─────────┐
│  Cron   │───▶│ Bull Queue │───▶│ Worker │───▶│ MongoDB │
│ (1 hr)  │    │  (Redis)   │    │        │    │         │
└─────────┘    └────────────┘    └───┬────┘    └─────────┘
                                     │
                              Socket.IO events
                                     ▼
                              Next.js Dashboard
```

Cron fires every hour, grabs active feed URLs from the `JobFeed` collection, and queues one Bull job per URL. The worker fetches the XML, parses it, transforms the items, and writes them to MongoDB in batches using `bulkWrite`. Each import run gets an `ImportLog` document that tracks counts and failure reasons. Socket.IO sends updates to the dashboard as batches finish — the frontend also polls every few seconds as a fallback so nothing gets missed if the socket drops.

## Why these tools

**Bull over BullMQ** — Bull v4 works with the standard redis package and the API is straightforward. BullMQ needs ioredis and doesn't add anything we actually use here.

**MongoDB + Mongoose** — job feeds have inconsistent shapes across sources. MongoDB handles that without fighting us. Mongoose gives indexes and validation without needing migrations.

**Express over Nest** — this is one service, not a platform. Express is simpler and there's no reason to add the Nest overhead for what we have.

**Socket.IO + polling** — Socket.IO is fine for pushing events. The polling fallback exists because WebSockets on managed hosting (Render, Vercel) can be flaky — the dashboard needs to stay accurate regardless.

## How imports work

Each job from a feed needs a stable ID so we can upsert without duplicates. If the RSS item has a `<guid>` we use that. Otherwise we generate an MD5 hash from the link + title + publish date — deterministic, so the same job fetched twice gets the same ID.

The actual write is a single `bulkWrite` call per batch with `updateOne` + `upsert: true` on each item, keyed by `jobId`. MongoDB handles the find-or-insert atomically per document. We don't do individual `findOne` + `create` — that's N queries per batch and creates race conditions when two jobs share an ID. With `bulkWrite` and `ordered: false` it's one round trip regardless of batch size.

`bulkWrite` returns `upsertedCount` and `modifiedCount` directly, so we know exactly how many were new vs updated without extra queries.

The import log updates every 10 batches instead of every batch. At scale (say 1M jobs, batch size 100) that would be 10,000 extra DB writes if we did it every time. The final counts get written when the import finishes anyway.

## Indexes

The Job collection only has indexes that are actually used:

- `jobId` unique — this is the dedup key, MongoDB creates the index automatically with `unique: true`
- `(source, jobId)` compound — for looking up jobs by feed
- `createdAt: -1` — for sorting recent jobs
- Text index on `(title, description)` — for search

We deliberately removed individual indexes on `title`, `company`, `location`, `category`, `jobType`, `publishedDate`, and `isActive`. None of them are queried individually in the current code, and each extra index slows down every write. At 1M+ documents that adds up.

## Retry and failure handling

Bull handles retries at the feed level — 3 attempts, exponential backoff starting at 2 seconds. If a feed times out or the server returns an error, it'll retry.

XML parse errors skip retries entirely. If the markup is broken, retrying the same URL won't fix it. We fail fast, log the error, and move on.

Inside a batch, validation failures get recorded per-job in `failedJobsDetails` on the ImportLog. The rest of the batch still runs. If `bulkWrite` itself throws (connection error etc), the whole batch is marked as failed.

## Worker setup

The worker runs inside the same Express process right now. That's fine for the current load. If you ever need to scale it independently — say you want multiple worker instances hammering the queue — the worker code in `workers/jobWorker.js` is self-contained. Point it at the same Redis queue and it just works. You'd remove the `startWorker()` call from `index.js` and run the worker as its own service.
