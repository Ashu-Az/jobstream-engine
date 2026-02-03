# System Design

## The big picture

The core idea is pretty straightforward: we have a bunch of RSS/XML feeds that spit out job listings, and we need to pull from all of them, deduplicate, and store them. The tricky part isn't fetching the data, it's doing it reliably at scale without hammering the feeds or the database.

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

Cron runs every hour, reads the active feed URLs out of MongoDB, and queues one job per feed into Bull. The worker picks those up, does the fetch + parse + import, and fires off Socket.IO events as things finish. The dashboard picks those up live, with polling as a safety net in case a socket event gets lost.

## Why a queue at all

I could have just fetched all the feeds in a loop inside the cron handler. But that means if one feed is slow or hangs, it blocks everything else. With Bull each feed is independent: one feed timing out doesn't hold up the others. It also gives us retry logic for free, and if we ever need to run multiple workers we just point them at the same queue.

## Tech choices and why

**Bull:** I looked at BullMQ too but it was more than we needed. Bull v4 has a clean API, works with the standard redis package, and handles retries and backoff out of the box. Good enough.

**MongoDB:** the feeds we're pulling from don't all have the same structure. Some have salary info, some don't. Some have categories, some bury that in the description. A rigid relational schema would be a headache to maintain every time a feed changes its format. MongoDB just lets us store whatever comes in and we normalize what we need in the transformer.

**Mongoose:** gives us schema validation and index definitions in code. I thought about using the raw MongoDB driver but Mongoose middleware and the schema DSL make it way easier to keep things consistent without writing a bunch of boilerplate.

**Express:** simple, no opinions, does what we need. Nest would be overkill for a single-service backend like this.

**Next.js + shadcn:** Next handles routing and the page layout. shadcn gives us table, card, badge, dialog components that are actually accessible and look decent without needing to pick a full design system.

**Socket.IO:** for pushing import status updates to the dashboard in real time. I added polling on top because WebSockets on managed hosting can be unreliable: the dashboard stays accurate either way.

## The import logic

The first thing I thought about was how to handle duplicates. If we fetch the same feed twice, we shouldn't end up with duplicate job records. So every job needs a stable ID that stays the same no matter how many times we pull it.

RSS feeds usually have a `<guid>` element for this. When they don't, I generate one by hashing the link + title + publish date together. MD5 is fine here: we're not doing security, just deduplication. The hash is deterministic so the same job always produces the same ID.

For the actual database write, I spent some time thinking about this. The obvious approach is to loop through each job, check if it exists with `findOne`, then either insert or update. The problem is that's two queries per job. At a million records that's two million queries for a single import run. And there's a race condition: if two jobs in the same batch happen to share a `jobId`, both can pass the `findOne` check at the same time and then one will crash when it tries to insert.

So I went with `bulkWrite` instead. One call per batch, each item is an `updateOne` with `upsert: true` keyed on `jobId`. MongoDB does the find-or-insert atomically per document on its end. No race condition, and it's one round trip to the DB per batch instead of N round trips. I set `ordered: false` so one bad document in the middle doesn't stop the rest from going through.

The nice thing about `bulkWrite` is it tells us the stats directly: `upsertedCount` for new documents, `modifiedCount` for updates. We don't need to query anything else to know what happened.

## Keeping the dashboard live without killing the DB

Each import run has an `ImportLog` document that tracks the running counts: new, updated, failed. The dashboard reads this to show progress.

Early on I had it updating the ImportLog after every single batch. That's fine when you're importing 50 jobs from one feed. But the requirement says this needs to handle a million records. At batch size 100 that's 10,000 batches, which means 10,000 extra DB writes just to keep a counter up to date. So I throttled it: the log updates every 10 batches now. The final numbers get written when the import completes, so nothing is lost. The dashboard might lag by a second or two during a big import but that's a reasonable trade-off.

## Indexes

I had way too many indexes on the Job collection initially. Individual indexes on title, company, location, category, jobType, publishedDate, isActive. Basically every field that seemed like it might be queried someday.

But none of those fields are actually queried individually anywhere in the code right now. And every index MongoDB maintains has to be updated on every write. At a million documents, that's a real cost. So I cut it down to just what we actually use:

- `jobId` unique: the dedup key, MongoDB creates this automatically
- `(source, jobId)`: for looking up all jobs from a specific feed
- `createdAt` descending: for sorting by recency
- Text index on title + description: for full-text search if we add it

If we add new query patterns later, we add indexes then. Not before.

## How it could evolve

Right now the worker runs inside the same Express process. That's simple and it works fine for the current load. But the worker code is already self-contained: it just needs Redis and MongoDB. If we ever need to scale horizontally, we pull it out into its own service, spin up multiple instances, and they all compete for jobs from the same Bull queue. No code changes needed in the worker itself, just the deployment setup.

The feed list is stored in MongoDB too, not hardcoded. So adding new sources is just a DB insert. If we wanted to support different feed formats down the line, not just RSS/XML but maybe JSON APIs, we'd add a `type` field to the feed config and route to the right parser in the fetcher service. The rest of the pipeline stays the same.
